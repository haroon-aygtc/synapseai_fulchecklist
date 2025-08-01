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
  private routingCache = new Map<string, Provider[]>();
  private healthCheckInterval: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService
  ) {
    this.initializeHealthChecking();
    this.initializeSmartRouting();
  }

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
      strategy?: 'cost' | 'latency' | 'quality' | 'balanced';
    }
  ): Promise<any> {
    const validatedData = ExecuteProviderSchema.parse(data);
    const startTime = Date.now();

    // Get smart-routed providers
    const providers = await this.getSmartRoutedProviders(organizationId, preferences);

    if (providers.length === 0) {
      throw new BadRequestException('No available providers found');
    }

    let lastError: Error | null = null;
    const attempts: Array<{ provider: Provider; error?: string; duration?: number }> = [];

    // Execute with fallback chain
    for (const provider of providers) {
      const attemptStart = Date.now();
      
      try {
        // Check circuit breaker
        if (await this.isCircuitBreakerOpen(provider.id)) {
          this.logger.warn(`Circuit breaker open for provider ${provider.name}`);
          continue;
        }

        // Execute with timeout and retry logic
        const result = await this.executeWithRetry(provider.id, validatedData, 3);
        const duration = Date.now() - attemptStart;

        // Track successful execution
        await this.trackProviderMetrics(provider.id, {
          requests: 1,
          tokens: this.estimateTokens(validatedData.messages),
          cost: this.calculateCost(provider, validatedData.messages),
          avgLatency: duration,
          errors: 0,
          success: true
        });

        // Update routing scores
        await this.updateRoutingScore(provider.id, 'success', duration);

        await this.apix.publishEvent('provider-events', {
          type: 'PROVIDER_EXECUTION_SUCCESS',
          providerId: provider.id,
          organizationId,
          duration,
          model: validatedData.model,
          strategy: preferences?.strategy || 'balanced'
        });

        return {
          ...result,
          provider: {
            id: provider.id,
            name: provider.name,
            type: provider.type
          },
          metadata: {
            ...result.metadata,
            duration,
            tokensUsed: this.estimateTokens(validatedData.messages),
            cost: this.calculateCost(provider, validatedData.messages),
            attempts: attempts.length + 1,
            strategy: preferences?.strategy || 'balanced'
          }
        };

      } catch (error) {
        const duration = Date.now() - attemptStart;
        lastError = error;
        
        attempts.push({
          provider,
          error: error.message,
          duration
        });

        this.logger.warn(`Provider ${provider.name} failed: ${error.message}`);

        // Track failed execution
        await this.trackProviderMetrics(provider.id, {
          requests: 1,
          tokens: 0,
          cost: 0,
          avgLatency: duration,
          errors: 1,
          success: false
        });

        // Update routing scores and circuit breaker
        await this.updateRoutingScore(provider.id, 'failure', duration);
        await this.updateCircuitBreaker(provider.id, false);

        await this.apix.publishEvent('provider-events', {
          type: 'PROVIDER_EXECUTION_FAILED',
          providerId: provider.id,
          organizationId,
          error: error.message,
          duration
        });

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    const totalDuration = Date.now() - startTime;
    
    await this.apix.publishEvent('provider-events', {
      type: 'ALL_PROVIDERS_FAILED',
      organizationId,
      attempts,
      totalDuration,
      lastError: lastError?.message
    });

    throw new BadRequestException(
      `All providers failed. Attempts: ${attempts.length}. Last error: ${lastError?.message}`
    );
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

  private async getSmartRoutedProviders(
    organizationId: string,
    preferences?: any
  ): Promise<Provider[]> {
    const cacheKey = `smart_routing:${organizationId}:${JSON.stringify(preferences)}`;
    
    // Check cache first
    let providers = this.routingCache.get(cacheKey);
    
    if (!providers) {
      providers = await this.calculateSmartRouting(organizationId, preferences);
      this.routingCache.set(cacheKey, providers);
      
      // Cache for 5 minutes
      setTimeout(() => {
        this.routingCache.delete(cacheKey);
      }, 300000);
    }

    return providers;
  }

  private async calculateSmartRouting(
    organizationId: string,
    preferences?: any
  ): Promise<Provider[]> {
    // Get all active providers
    let providers = await this.prisma.provider.findMany({
      where: {
        organizationId,
        isActive: true
      },
      include: {
        routingRules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' }
        },
        usageMetrics: {
          take: 7,
          orderBy: { date: 'desc' }
        }
      }
    });

    // Filter by capabilities
    if (preferences?.requireCapabilities) {
      providers = providers.filter(provider =>
        preferences.requireCapabilities.every((cap: string) =>
          provider.capabilities.includes(cap)
        )
      );
    }

    // Filter by cost constraints
    if (preferences?.maxCost) {
      providers = providers.filter(provider =>
        !provider.costPerToken || provider.costPerToken <= preferences.maxCost
      );
    }

    // Calculate routing scores
    const scoredProviders = await Promise.all(
      providers.map(async (provider) => {
        const score = await this.calculateRoutingScore(provider, preferences);
        return { provider, score };
      })
    );

    // Sort by score and apply strategy
    const strategy = preferences?.strategy || 'balanced';
    const sortedProviders = this.applySortingStrategy(scoredProviders, strategy);

    // Apply preferred provider logic
    if (preferences?.preferredProvider) {
      const preferred = sortedProviders.find(
        ({ provider }) => provider.id === preferences.preferredProvider
      );
      if (preferred) {
        return [
          preferred.provider,
          ...sortedProviders
            .filter(({ provider }) => provider.id !== preferences.preferredProvider)
            .map(({ provider }) => provider)
        ];
      }
    }

    return sortedProviders.map(({ provider }) => provider);
  }

  private async calculateRoutingScore(
    provider: Provider,
    preferences?: any
  ): Promise<number> {
    let score = provider.priority || 0;

    // Health score (0-100)
    const healthScore = await this.getProviderHealthScore(provider.id);
    score += healthScore * 0.3;

    // Performance score based on recent metrics
    const performanceScore = await this.getProviderPerformanceScore(provider.id);
    score += performanceScore * 0.3;

    // Cost efficiency score
    const costScore = this.calculateCostScore(provider, preferences);
    score += costScore * 0.2;

    // Capability match score
    const capabilityScore = this.calculateCapabilityScore(provider, preferences);
    score += capabilityScore * 0.2;

    return Math.max(0, Math.min(100, score));
  }

  private applySortingStrategy(
    scoredProviders: Array<{ provider: Provider; score: number }>,
    strategy: string
  ): Array<{ provider: Provider; score: number }> {
    switch (strategy) {
      case 'cost':
        return scoredProviders.sort((a, b) => 
          (a.provider.costPerToken || 0) - (b.provider.costPerToken || 0)
        );
      
      case 'latency':
        return scoredProviders.sort((a, b) => {
          const aLatency = (a.provider.metadata as any)?.avgLatency || Infinity;
          const bLatency = (b.provider.metadata as any)?.avgLatency || Infinity;
          return aLatency - bLatency;
        });
      
      case 'quality':
        return scoredProviders.sort((a, b) => {
          const aQuality = (a.provider.metadata as any)?.qualityScore || 0;
          const bQuality = (b.provider.metadata as any)?.qualityScore || 0;
          return bQuality - aQuality;
        });
      
      case 'balanced':
      default:
        return scoredProviders.sort((a, b) => b.score - a.score);
    }
  }

  private async isCircuitBreakerOpen(providerId: string): Promise<boolean> {
    const key = `circuit_breaker:${providerId}`;
    const state = await this.redis.get(key);
    
    if (!state) return false;
    
    const { status, openedAt, failureCount } = JSON.parse(state);
    
    if (status === 'open') {
      const now = Date.now();
      const timeSinceOpened = now - openedAt;
      
      // Half-open after 60 seconds
      if (timeSinceOpened > 60000) {
        await this.redis.set(key, JSON.stringify({
          status: 'half-open',
          openedAt,
          failureCount
        }), 'EX', 300);
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  private async updateCircuitBreaker(providerId: string, success: boolean): Promise<void> {
    const key = `circuit_breaker:${providerId}`;
    const state = await this.redis.get(key);
    
    let circuitState = state ? JSON.parse(state) : {
      status: 'closed',
      failureCount: 0,
      successCount: 0
    };

    if (success) {
      circuitState.successCount = (circuitState.successCount || 0) + 1;
      circuitState.failureCount = Math.max(0, circuitState.failureCount - 1);
      
      // Close circuit if it was half-open and we got success
      if (circuitState.status === 'half-open') {
        circuitState.status = 'closed';
        circuitState.failureCount = 0;
      }
    } else {
      circuitState.failureCount = (circuitState.failureCount || 0) + 1;
      
      // Open circuit after 5 consecutive failures
      if (circuitState.failureCount >= 5) {
        circuitState.status = 'open';
        circuitState.openedAt = Date.now();
      }
    }

    await this.redis.set(key, JSON.stringify(circuitState), 'EX', 3600);
  }

  private async executeWithRetry(
    providerId: string,
    data: any,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithProvider(providerId, data);
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          this.logger.warn(
            `Retry attempt ${attempt} for provider ${providerId} after ${delay}ms delay`
          );
        }
      }
    }
    
    throw lastError;
  }

  private isNonRetryableError(error: any): boolean {
    // Don't retry on authentication, validation, or quota errors
    const nonRetryableMessages = [
      'invalid api key',
      'authentication failed',
      'quota exceeded',
      'invalid request',
      'validation error'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return nonRetryableMessages.some(msg => errorMessage.includes(msg));
  }

  private initializeHealthChecking(): void {
    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const providers = await this.prisma.provider.findMany({
        where: { isActive: true }
      });

      const healthChecks = providers.map(async (provider) => {
        try {
          const isHealthy = await this.checkProviderHealth(provider.id);
          await this.updateProviderHealth(provider.id, isHealthy);
        } catch (error) {
          this.logger.error(`Health check failed for provider ${provider.id}: ${error.message}`);
          await this.updateProviderHealth(provider.id, false);
        }
      });

      await Promise.allSettled(healthChecks);
    } catch (error) {
      this.logger.error(`Health check batch failed: ${error.message}`);
    }
  }

  private async updateProviderHealth(providerId: string, isHealthy: boolean): Promise<void> {
    const key = `provider_health:${providerId}`;
    const healthData = {
      isHealthy,
      lastCheck: Date.now(),
      consecutiveFailures: isHealthy ? 0 : await this.getConsecutiveFailures(providerId) + 1
    };

    await this.redis.set(key, JSON.stringify(healthData), 'EX', 300);

    // Disable provider after 5 consecutive health check failures
    if (healthData.consecutiveFailures >= 5) {
      await this.prisma.provider.update({
        where: { id: providerId },
        data: { isActive: false }
      });

      await this.apix.publishEvent('provider-events', {
        type: 'PROVIDER_DISABLED',
        providerId,
        reason: 'consecutive_health_failures'
      });
    }
  }

  private async getConsecutiveFailures(providerId: string): Promise<number> {
    const key = `provider_health:${providerId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data).consecutiveFailures || 0 : 0;
  }

  private async getProviderHealthScore(providerId: string): Promise<number> {
    const key = `provider_health:${providerId}`;
    const data = await this.redis.get(key);
    
    if (!data) return 50; // Default neutral score
    
    const { isHealthy, consecutiveFailures } = JSON.parse(data);
    
    if (!isHealthy) return 0;
    
    // Score decreases with consecutive failures
    return Math.max(0, 100 - (consecutiveFailures * 20));
  }

  private async getProviderPerformanceScore(providerId: string): Promise<number> {
    const metrics = await this.prisma.providerUsageMetric.findMany({
      where: { providerId },
      orderBy: { date: 'desc' },
      take: 7
    });

    if (metrics.length === 0) return 50;

    const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
    const avgLatency = metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length;

    // Calculate error rate
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    // Calculate performance score
    let score = 100;
    score -= errorRate * 2; // Penalize errors heavily
    score -= Math.min(50, avgLatency / 100); // Penalize high latency
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateCostScore(provider: Provider, preferences?: any): number {
    if (!provider.costPerToken) return 50;
    
    const maxAcceptableCost = preferences?.maxCost || 0.01;
    const costRatio = provider.costPerToken / maxAcceptableCost;
    
    // Lower cost = higher score
    return Math.max(0, 100 - (costRatio * 50));
  }

  private calculateCapabilityScore(provider: Provider, preferences?: any): number {
    if (!preferences?.requireCapabilities) return 100;
    
    const requiredCaps = preferences.requireCapabilities;
    const matchedCaps = requiredCaps.filter((cap: string) => 
      provider.capabilities.includes(cap)
    );
    
    return (matchedCaps.length / requiredCaps.length) * 100;
  }

  private async trackProviderMetrics(providerId: string, metrics: {
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
    errors: number;
    success: boolean;
  }): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update daily metrics
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
        avgLatency: this.calculateRunningAverage(
          'avgLatency',
          providerId,
          metrics.avgLatency
        )
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

    // Update real-time metrics in Redis
    const realtimeKey = `provider_realtime:${providerId}`;
    const realtimeData = await this.redis.get(realtimeKey);
    
    let realtime = realtimeData ? JSON.parse(realtimeData) : {
      requests: 0,
      errors: 0,
      totalLatency: 0,
      successCount: 0
    };

    realtime.requests += metrics.requests;
    realtime.errors += metrics.errors;
    realtime.totalLatency += metrics.avgLatency;
    if (metrics.success) realtime.successCount += 1;

    await this.redis.set(realtimeKey, JSON.stringify(realtime), 'EX', 3600);
  }

  private async calculateRunningAverage(
    field: string,
    providerId: string,
    newValue: number
  ): Promise<number> {
    const existing = await this.prisma.providerUsageMetric.findFirst({
      where: { providerId },
      orderBy: { date: 'desc' }
    });

    if (!existing) return newValue;

    const currentAvg = existing[field as keyof typeof existing] as number || 0;
    const currentCount = existing.requests || 1;
    
    return ((currentAvg * currentCount) + newValue) / (currentCount + 1);
  }

  private async updateRoutingScore(
    providerId: string,
    outcome: 'success' | 'failure',
    latency: number
  ): Promise<void> {
    const key = `routing_score:${providerId}`;
    const data = await this.redis.get(key);
    
    let score = data ? JSON.parse(data) : {
      value: 50,
      successCount: 0,
      failureCount: 0,
      avgLatency: 0,
      lastUpdated: Date.now()
    };

    if (outcome === 'success') {
      score.successCount += 1;
      score.value = Math.min(100, score.value + 2);
    } else {
      score.failureCount += 1;
      score.value = Math.max(0, score.value - 5);
    }

    // Update average latency
    const totalRequests = score.successCount + score.failureCount;
    score.avgLatency = ((score.avgLatency * (totalRequests - 1)) + latency) / totalRequests;
    score.lastUpdated = Date.now();

    await this.redis.set(key, JSON.stringify(score), 'EX', 86400);
  }

  private initializeSmartRouting(): void {
    // Clear routing cache every 5 minutes
    setInterval(() => {
      this.routingCache.clear();
    }, 300000);
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

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
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