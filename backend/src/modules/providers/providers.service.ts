import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { Provider, ProviderType, ProviderRoutingRule } from '@prisma/client';
import { z } from 'zod';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

const CreateProviderSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(ProviderType),
  endpoint: z.string().url().optional(),
  apiKey: z.string().min(1),
  config: z.record(z.any()).default({}),
  capabilities: z.array(z.string()).default([]),
  priority: z.number().min(0).max(100).default(0),
  rateLimit: z.number().positive().optional(),
  costPerToken: z.number().positive().optional()
});

const UpdateProviderSchema = CreateProviderSchema.partial();

const ExecuteProviderSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string()
  })),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(2048),
  stream: z.boolean().default(false),
  tools: z.array(z.any()).optional()
});

interface ProviderClient {
  execute(params: any): Promise<any>;
  executeStream(params: any): AsyncIterable<string>;
  getModels(): Promise<string[]>;
  validateConfig(): Promise<boolean>;
}

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private providerClients = new Map<string, ProviderClient>();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService
  ) {}

  async createProvider(
    userId: string,
    organizationId: string,
    data: z.infer<typeof CreateProviderSchema>
  ): Promise<Provider> {
    const validatedData = CreateProviderSchema.parse(data);

    // Validate provider configuration
    await this.validateProviderConfig(validatedData.type, validatedData);

    const provider = await this.prisma.provider.create({
      data: {
        ...validatedData,
        userId,
        organizationId,
        config: validatedData.config,
        capabilities: validatedData.capabilities,
        metadata: {
          createdBy: userId,
          lastHealthCheck: null,
          totalRequests: 0,
          totalErrors: 0
        }
      }
    });

    // Initialize provider client
    await this.initializeProviderClient(provider);

    await this.apix.publishEvent('provider-events', {
      type: 'PROVIDER_CREATED',
      providerId: provider.id,
      organizationId,
      data: provider
    });

    return provider;
  }

  async getProviders(organizationId: string, filters?: {
    type?: ProviderType;
    isActive?: boolean;
  }): Promise<Provider[]> {
    const where: any = { organizationId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.provider.findMany({
      where,
      include: {
        routingRules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' }
        },
        usageMetrics: {
          take: 30,
          orderBy: { date: 'desc' }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async getProvider(id: string, organizationId: string): Promise<Provider> {
    const provider = await this.prisma.provider.findFirst({
      where: { id, organizationId },
      include: {
        routingRules: {
          orderBy: { priority: 'desc' }
        },
        usageMetrics: {
          take: 30,
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    return provider;
  }

  async updateProvider(
    id: string,
    organizationId: string,
    data: z.infer<typeof UpdateProviderSchema>
  ): Promise<Provider> {
    const validatedData = UpdateProviderSchema.parse(data);

    const existingProvider = await this.prisma.provider.findFirst({
      where: { id, organizationId }
    });

    if (!existingProvider) {
      throw new NotFoundException('Provider not found');
    }

    if (validatedData.type || validatedData.apiKey || validatedData.config) {
      await this.validateProviderConfig(
        validatedData.type || existingProvider.type,
        { ...existingProvider, ...validatedData }
      );
    }

    const provider = await this.prisma.provider.update({
      where: { id },
      data: {
        ...validatedData,
        updatedAt: new Date()
      }
    });

    // Reinitialize provider client if config changed
    if (validatedData.apiKey || validatedData.config || validatedData.endpoint) {
      await this.initializeProviderClient(provider);
    }

    await this.apix.publishEvent('provider-events', {
      type: 'PROVIDER_UPDATED',
      providerId: provider.id,
      organizationId,
      data: provider
    });

    return provider;
  }

  async deleteProvider(id: string, organizationId: string): Promise<void> {
    const provider = await this.prisma.provider.findFirst({
      where: { id, organizationId }
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    await this.prisma.provider.delete({
      where: { id }
    });

    // Remove provider client
    this.providerClients.delete(id);

    await this.apix.publishEvent('provider-events', {
      type: 'PROVIDER_DELETED',
      providerId: id,
      organizationId
    });
  }

  async executeWithSmartRouting(
    organizationId: string,
    data: z.infer<typeof ExecuteProviderSchema>,
    preferences?: {
      preferredProvider?: string;
      maxCost?: number;
      maxLatency?: number;
      requireCapabilities?: string[];
    }
  ): Promise<any> {
    const validatedData = ExecuteProviderSchema.parse(data);

    // Get available providers with routing rules
    const providers = await this.getAvailableProviders(organizationId, preferences);

    if (providers.length === 0) {
      throw new BadRequestException('No available providers found');
    }

    let lastError: Error | null = null;

    // Try providers in order of priority
    for (const provider of providers) {
      try {
        const startTime = Date.now();

        const result = await this.executeWithProvider(provider.id, validatedData);

        const duration = Date.now() - startTime;

        // Track successful execution
        await this.trackProviderUsage(provider.id, {
          requests: 1,
          tokens: this.estimateTokens(validatedData.messages),
          cost: this.calculateCost(provider, validatedData.messages),
          avgLatency: duration,
          errors: 0
        });

        await this.apix.publishEvent('provider-events', {
          type: 'PROVIDER_EXECUTION_SUCCESS',
          providerId: provider.id,
          organizationId,
          duration,
          model: validatedData.model
        });

        return {
          ...result,
          provider: {
            id: provider.id,
            name: provider.name,
            type: provider.type
          },
          metadata: {
            duration,
            tokensUsed: this.estimateTokens(validatedData.messages),
            cost: this.calculateCost(provider, validatedData.messages)
          }
        };

      } catch (error) {
        lastError = error;
        this.logger.warn(`Provider ${provider.name} failed: ${error.message}`);

        // Track failed execution
        await this.trackProviderUsage(provider.id, {
          requests: 1,
          tokens: 0,
          cost: 0,
          avgLatency: 0,
          errors: 1
        });

        await this.apix.publishEvent('provider-events', {
          type: 'PROVIDER_EXECUTION_FAILED',
          providerId: provider.id,
          organizationId,
          error: error.message
        });

        // Continue to next provider in fallback chain
        continue;
      }
    }

    // All providers failed
    throw new BadRequestException(`All providers failed. Last error: ${lastError?.message}`);
  }

  async executeWithProvider(
    providerId: string,
    data: z.infer<typeof ExecuteProviderSchema>
  ): Promise<any> {
    const client = this.providerClients.get(providerId);
    if (!client) {
      throw new BadRequestException('Provider client not initialized');
    }

    if (data.stream) {
      return client.executeStream(data);
    } else {
      return client.execute(data);
    }
  }

  private async getAvailableProviders(
    organizationId: string,
    preferences?: any
  ): Promise<Provider[]> {
    let providers = await this.prisma.provider.findMany({
      where: {
        organizationId,
        isActive: true
      },
      include: {
        routingRules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    // Filter by preferences
    if (preferences?.preferredProvider) {
      const preferred = providers.find(p => p.id === preferences.preferredProvider);
      if (preferred) {
        providers = [preferred, ...providers.filter(p => p.id !== preferences.preferredProvider)];
      }
    }

    if (preferences?.requireCapabilities) {
      providers = providers.filter(provider =>
        preferences.requireCapabilities.every((cap: string) =>
          provider.capabilities.includes(cap)
        )
      );
    }

    if (preferences?.maxCost) {
      providers = providers.filter(provider =>
        !provider.costPerToken || provider.costPerToken <= preferences.maxCost
      );
    }

    // Check provider health
    const healthyProviders = [];
    for (const provider of providers) {
      if (await this.checkProviderHealth(provider.id)) {
        healthyProviders.push(provider);
      }
    }

    return healthyProviders;
  }

  private async initializeProviderClient(provider: Provider): Promise<void> {
    let client: ProviderClient;

    switch (provider.type) {
      case ProviderType.OPENAI:
        client = new OpenAIClient(provider);
        break;
      case ProviderType.ANTHROPIC:
        client = new AnthropicClient(provider);
        break;
      case ProviderType.GOOGLE:
        client = new GoogleClient(provider);
        break;
      case ProviderType.MISTRAL:
        client = new MistralClient(provider);
        break;
      case ProviderType.GROQ:
        client = new GroqClient(provider);
        break;
      case ProviderType.DEEPSEEK:
        client = new DeepSeekClient(provider);
        break;
      case ProviderType.HUGGINGFACE:
        client = new HuggingFaceClient(provider);
        break;
      case ProviderType.OPENROUTER:
        client = new OpenRouterClient(provider);
        break;
      case ProviderType.OLLAMA:
        client = new OllamaClient(provider);
        break;
      case ProviderType.LOCALAI:
        client = new LocalAIClient(provider);
        break;
      case ProviderType.CUSTOM:
        client = new CustomClient(provider);
        break;
      default:
        throw new BadRequestException(`Unsupported provider type: ${provider.type}`);
    }

    this.providerClients.set(provider.id, client);
  }

  private async validateProviderConfig(type: ProviderType, config: any): Promise<void> {
    switch (type) {
      case ProviderType.OPENAI:
        if (!config.apiKey) {
          throw new BadRequestException('OpenAI provider requires API key');
        }
        break;
      case ProviderType.ANTHROPIC:
        if (!config.apiKey) {
          throw new BadRequestException('Anthropic provider requires API key');
        }
        break;
      case ProviderType.GOOGLE:
        if (!config.apiKey) {
          throw new BadRequestException('Google provider requires API key');
        }
        break;
      case ProviderType.OLLAMA:
      case ProviderType.LOCALAI:
        if (!config.endpoint) {
          throw new BadRequestException(`${type} provider requires endpoint URL`);
        }
        break;
    }
  }

  private async checkProviderHealth(providerId: string): Promise<boolean> {
    try {
      const cacheKey = `provider_health:${providerId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const client = this.providerClients.get(providerId);
      if (!client) {
        return false;
      }

      const isHealthy = await client.validateConfig();
      
      // Cache health status for 5 minutes
      await this.redis.set(cacheKey, JSON.stringify(isHealthy), 300);
      
      return isHealthy;
    } catch (error) {
      this.logger.error(`Health check failed for provider ${providerId}: ${error.message}`);
      return false;
    }
  }

  private async trackProviderUsage(providerId: string, metrics: {
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
    errors: number;
  }): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.providerUsageMetric.upsert({
      where: {
        providerId_date: {
          providerId,
          date: today
        }
      },
      update: {
        requests: { increment: metrics.requests },
        tokens: { increment: metrics.tokens },
        cost: { increment: metrics.cost },
        errors: { increment: metrics.errors },
        avgLatency: metrics.avgLatency // This should be calculated properly
      },
      create: {
        providerId,
        date: today,
        requests: metrics.requests,
        tokens: metrics.tokens,
        cost: metrics.cost,
        errors: metrics.errors,
        avgLatency: metrics.avgLatency
      }
    });
  }

  private estimateTokens(messages: any[]): number {
    // Simple token estimation - in production, use proper tokenization
    return messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
  }

  private calculateCost(provider: Provider, messages: any[]): number {
    if (!provider.costPerToken) return 0;
    return this.estimateTokens(messages) * provider.costPerToken;
  }

  async getProviderAnalytics(providerId: string, organizationId: string): Promise<any> {
    const provider = await this.getProvider(providerId, organizationId);

    const metrics = await this.prisma.providerUsageMetric.findMany({
      where: { providerId },
      orderBy: { date: 'desc' },
      take: 30
    });

    const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    const avgLatency = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length 
      : 0;

    return {
      provider,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      totalCost,
      avgLatency,
      dailyMetrics: metrics.reverse()
    };
  }
}

// Provider Client Implementations
class OpenAIClient implements ProviderClient {
  private client: OpenAI;

  constructor(private provider: Provider) {
    this.client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.endpoint || undefined
    });
  }

  async execute(params: any): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: params.model || 'gpt-4',
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      tools: params.tools
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage,
      model: response.model
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: params.model || 'gpt-4',
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  }

  async getModels(): Promise<string[]> {
    const models = await this.client.models.list();
    return models.data.map(model => model.id);
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}

class AnthropicClient implements ProviderClient {
  private client: Anthropic;

  constructor(private provider: Provider) {
    this.client = new Anthropic({
      apiKey: provider.apiKey
    });
  }

  async execute(params: any): Promise<any> {
    const systemMessage = params.messages.find((m: any) => m.role === 'system');
    const messages = params.messages.filter((m: any) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: params.model || 'claude-3-sonnet-20240229',
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: systemMessage?.content,
      messages
    });

    return {
      content: response.content[0]?.type === 'text' ? response.content[0].text : '',
      usage: response.usage,
      model: response.model
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    const systemMessage = params.messages.find((m: any) => m.role === 'system');
    const messages = params.messages.filter((m: any) => m.role !== 'system');

    const stream = await this.client.messages.create({
      model: params.model || 'claude-3-sonnet-20240229',
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: systemMessage?.content,
      messages,
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }

  async getModels(): Promise<string[]> {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch {
      return false;
    }
  }
}

class GoogleClient implements ProviderClient {
  private client: GoogleGenerativeAI;

  constructor(private provider: Provider) {
    this.client = new GoogleGenerativeAI(provider.apiKey);
  }

  async execute(params: any): Promise<any> {
    const model = this.client.getGenerativeModel({ 
      model: params.model || 'gemini-pro' 
    });

    const chat = model.startChat({
      history: params.messages.slice(0, -1).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    });

    const lastMessage = params.messages[params.messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;

    return {
      content: response.text(),
      usage: null, // Google doesn't provide usage info in the same format
      model: params.model || 'gemini-pro'
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    const model = this.client.getGenerativeModel({ 
      model: params.model || 'gemini-pro' 
    });

    const chat = model.startChat({
      history: params.messages.slice(0, -1).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    });

    const lastMessage = params.messages[params.messages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  }

  async getModels(): Promise<string[]> {
    return ['gemini-pro', 'gemini-pro-vision'];
  }

  async validateConfig(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('test');
      return true;
    } catch {
      return false;
    }
  }
}

// Additional client implementations for other providers...
class MistralClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const response = await axios.post(
      this.provider.endpoint || 'https://api.mistral.ai/v1/chat/completions',
      {
        model: params.model || 'mistral-medium',
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    // Implement streaming for Mistral
    yield* this.execute(params).then(result => [result.content]);
  }

  async getModels(): Promise<string[]> {
    return ['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large'];
  }

  async validateConfig(): Promise<boolean> {
    try {
      await axios.get(
        this.provider.endpoint || 'https://api.mistral.ai/v1/models',
        {
          headers: { 'Authorization': `Bearer ${this.provider.apiKey}` }
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}

class GroqClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: params.model || 'mixtral-8x7b-32768',
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    // Implement streaming for Groq
    yield* this.execute(params).then(result => [result.content]);
  }

  async getModels(): Promise<string[]> {
    return ['mixtral-8x7b-32768', 'llama2-70b-4096'];
  }

  async validateConfig(): Promise<boolean> {
    try {
      await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${this.provider.apiKey}` }
      });
      return true;
    } catch {
      return false;
    }
  }
}

class DeepSeekClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: params.model || 'deepseek-chat',
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    yield* this.execute(params).then(result => [result.content]);
  }

  async getModels(): Promise<string[]> {
    return ['deepseek-chat', 'deepseek-coder'];
  }

  async validateConfig(): Promise<boolean> {
    try {
      await axios.get('https://api.deepseek.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.provider.apiKey}` }
      });
      return true;
    } catch {
      return false;
    }
  }
}

class HuggingFaceClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${params.model || 'microsoft/DialoGPT-medium'}`,
      {
        inputs: params.messages[params.messages.length - 1].content,
        parameters: {
          temperature: params.temperature,
          max_length: params.maxTokens
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data[0]?.generated_text || '',
      usage: null,
      model: params.model || 'microsoft/DialoGPT-medium'
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    yield* this.execute(params).then(result => [result.content]);
  }

  async getModels(): Promise<string[]> {
    return ['microsoft/DialoGPT-medium', 'facebook/blenderbot-400M-distill'];
  }

  async validateConfig(): Promise<boolean> {
    try {
      await axios.get('https://huggingface.co/api/whoami', {
        headers: { 'Authorization': `Bearer ${this.provider.apiKey}` }
      });
      return true;
    } catch {
      return false;
    }
  }
}

class OpenRouterClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: params.model || 'openai/gpt-3.5-turbo',
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://synapseai.com',
          'X-Title': 'SynapseAI'
        }
      }
    );

    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    yield* this.execute(params).then(result => [result.content]);
  }

  async getModels(): Promise<string[]> {
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${this.provider.apiKey}` }
    });
    return response.data.data.map((model: any) => model.id);
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.getModels();
      return true;
    } catch {
      return false;
    }
  }
}

class OllamaClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const response = await axios.post(
      `${this.provider.endpoint}/api/chat`,
      {
        model: params.model || 'llama2',
        messages: params.messages,
        stream: false,
        options: {
          temperature: params.temperature,
          num_predict: params.maxTokens
        }
      }
    );

    return {
      content: response.data.message?.content || '',
      usage: null,
      model: params.model || 'llama2'
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    const response = await axios.post(
      `${this.provider.endpoint}/api/chat`,
      {
        model: params.model || 'llama2',
        messages: params.messages,
        stream: true,
        options: {
          temperature: params.temperature,
          num_predict: params.maxTokens
        }
      },
      { responseType: 'stream' }
    );

    for await (const chunk of response.data) {
      const data = JSON.parse(chunk.toString());
      if (data.message?.content) {
        yield data.message.content;
      }
    }
  }

  async getModels(): Promise<string[]> {
    const response = await axios.get(`${this.provider.endpoint}/api/tags`);
    return response.data.models.map((model: any) => model.name);
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.getModels();
      return true;
    } catch {
      return false;
    }
  }
}

class LocalAIClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const response = await axios.post(
      `${this.provider.endpoint}/v1/chat/completions`,
      {
        model: params.model || 'gpt-3.5-turbo',
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens
      }
    );

    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async *executeStream(params: any): AsyncIterable<string> {
    yield* this.execute(params).then(result => [result.content]);
  }

  async getModels(): Promise<string[]> {
    const response = await axios.get(`${this.provider.endpoint}/v1/models`);
    return response.data.data.map((model: any) => model.id);
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.getModels();
      return true;
    } catch {
      return false;
    }
  }
}

class CustomClient implements ProviderClient {
  constructor(private provider: Provider) {}

  async execute(params: any): Promise<any> {
    const config = this.provider.config as any;
    
    const response = await axios({
      method: config.method || 'POST',
      url: this.provider.endpoint,
      data: this.transformRequest(params, config),
      headers: this.buildHeaders(config)
    });

    return this.transformResponse(response.data, config);
  }

  async *executeStream(params: any): AsyncIterable<string> {
    yield* this.execute(params).then(result => [result.content]);
  }

  async getModels(): Promise<string[]> {
    const config = this.provider.config as any;
    return config.availableModels || ['custom-model'];
  }

  async validateConfig(): Promise<boolean> {
    try {
      await axios.get(this.provider.endpoint);
      return true;
    } catch {
      return false;
    }
  }

  private transformRequest(params: any, config: any): any {
    // Transform request based on custom provider configuration
    return config.requestTransform ? 
      this.applyTransform(params, config.requestTransform) : 
      params;
  }

  private transformResponse(data: any, config: any): any {
    // Transform response based on custom provider configuration
    return config.responseTransform ? 
      this.applyTransform(data, config.responseTransform) : 
      { content: data.content || data.text || '', usage: null, model: 'custom' };
  }

  private buildHeaders(config: any): any {
    const headers: any = { 'Content-Type': 'application/json' };
    
    if (this.provider.apiKey) {
      headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
    }

    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    return headers;
  }

  private applyTransform(data: any, transform: any): any {
    // Simple transformation logic - in production, use a proper transformation engine
    return data;
  }
}