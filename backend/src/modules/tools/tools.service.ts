import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { Tool, ToolType, ToolExecution, ExecutionStatus } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';
import * as vm from 'vm';
import * as puppeteer from 'puppeteer';

const CreateToolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.nativeEnum(ToolType),
  inputSchema: z.record(z.any()).default({}),
  outputSchema: z.record(z.any()).default({}),
  code: z.string().optional(),
  endpoint: z.string().url().optional(),
  authentication: z.object({
    type: z.enum(['none', 'api_key', 'bearer', 'basic', 'oauth']).default('none'),
    apiKey: z.string().optional(),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    headerName: z.string().optional(),
    oauth: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      tokenUrl: z.string(),
      scope: z.string().optional()
    }).optional()
  }).default({ type: 'none' }),
  config: z.object({
    timeout: z.number().positive().default(30000),
    retries: z.number().min(0).max(5).default(3),
    rateLimit: z.number().positive().optional(),
    cacheTtl: z.number().positive().optional(),
    validateInput: z.boolean().default(true),
    validateOutput: z.boolean().default(false),
    logExecution: z.boolean().default(true),
    enableMetrics: z.boolean().default(true),
    customHeaders: z.record(z.string()).default({}),
    environment: z.enum(['development', 'staging', 'production']).default('production')
  }).default({}),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({})
});

const UpdateToolSchema = CreateToolSchema.partial();

const ExecuteToolSchema = z.object({
  input: z.record(z.any()),
  sessionId: z.string().optional(),
  timeout: z.number().positive().optional(),
  context: z.record(z.any()).default({})
});

const ExecuteToolSchema = z.object({
  input: z.record(z.any()).default({}),
  context: z.record(z.any()).default({}),
  options: z.object({
    timeout: z.number().positive().optional(),
    retries: z.number().min(0).max(5).optional(),
    validateInput: z.boolean().optional(),
    validateOutput: z.boolean().optional(),
    enableCache: z.boolean().default(true),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL')
  }).default({})
});

interface ToolExecutionContext {
  toolId: string;
  executionId: string;
  input: any;
  context: any;
  options: any;
  userId: string;
  organizationId: string;
  startTime: number;
}

interface ToolMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
  avgCost: number;
  lastExecuted: Date;
  errorRate: number;
  popularityScore: number;
}

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private executionCache = new Map<string, any>();
  private rateLimiters = new Map<string, any>();
  private browserInstance: puppeteer.Browser | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService
  ) {
    this.initializeBrowser();
    this.initializeRateLimiters();
  }

  async createTool(
    userId: string,
    organizationId: string,
    data: z.infer<typeof CreateToolSchema>
  ): Promise<Tool> {
    const validatedData = CreateToolSchema.parse(data);

    // Validate tool configuration based on type
    await this.validateToolConfiguration(validatedData);

    const tool = await this.prisma.tool.create({
      data: {
        ...validatedData,
        userId,
        organizationId,
        inputSchema: validatedData.inputSchema,
        outputSchema: validatedData.outputSchema,
        authentication: validatedData.authentication,
        config: validatedData.config,
        metadata: {
          ...validatedData.metadata,
          createdBy: userId,
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          avgExecutionTime: 0,
          lastExecuted: null,
          errorRate: 0,
          popularityScore: 0
        }
      }
    });

    // Initialize rate limiter if needed
    if (validatedData.config.rateLimit) {
      this.initializeRateLimiter(tool.id, validatedData.config.rateLimit);
    }

    await this.apix.publishEvent('tool-events', {
      type: 'TOOL_CREATED',
      toolId: tool.id,
      organizationId,
      data: tool
    });

    return tool;
  }

  async getTools(
    organizationId: string,
    filters?: {
      type?: ToolType;
      category?: string;
      tags?: string[];
      search?: string;
      isActive?: boolean;
    }
  ): Promise<Tool[]> {
    const where: any = { organizationId, isActive: true };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return this.prisma.tool.findMany({
      where,
      include: {
        executions: {
          take: 5,
          orderBy: { startedAt: 'desc' }
        },
        _count: {
          select: { executions: true }
        }
      },
      orderBy: [
        { metadata: { path: ['popularityScore'], sort: 'desc' } },
        { updatedAt: 'desc' }
      ]
    });
  }

  async getTool(id: string, organizationId: string): Promise<Tool> {
    const tool = await this.prisma.tool.findFirst({
      where: { id, organizationId },
      include: {
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    return tool;
  }

  async updateTool(
    id: string,
    organizationId: string,
    data: z.infer<typeof UpdateToolSchema>
  ): Promise<Tool> {
    const validatedData = UpdateToolSchema.parse(data);

    const existingTool = await this.prisma.tool.findFirst({
      where: { id, organizationId }
    });

    if (!existingTool) {
      throw new NotFoundException('Tool not found');
    }

    // Validate updated configuration
    if (validatedData.type || validatedData.config || validatedData.authentication) {
      const toolToValidate = { ...existingTool, ...validatedData };
      await this.validateToolConfiguration(toolToValidate);
    }

    const tool = await this.prisma.tool.update({
      where: { id },
      data: {
        ...validatedData,
        version: { increment: 1 },
        updatedAt: new Date(),
        metadata: {
          ...existingTool.metadata,
          lastModifiedBy: organizationId
        }
      }
    });

    // Update rate limiter if needed
    if (validatedData.config?.rateLimit) {
      this.initializeRateLimiter(tool.id, validatedData.config.rateLimit);
    }

    await this.apix.publishEvent('tool-events', {
      type: 'TOOL_UPDATED',
      toolId: tool.id,
      organizationId,
      data: tool
    });

    return tool;
  }

  async deleteTool(id: string, organizationId: string): Promise<void> {
    const tool = await this.prisma.tool.findFirst({
      where: { id, organizationId }
    });

    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    // Clean up rate limiter
    this.rateLimiters.delete(id);

    // Clean up cache entries
    const cacheKeys = Array.from(this.executionCache.keys()).filter(key => key.startsWith(id));
    cacheKeys.forEach(key => this.executionCache.delete(key));

    await this.prisma.tool.delete({
      where: { id }
    });

    await this.apix.publishEvent('tool-events', {
      type: 'TOOL_DELETED',
      toolId: id,
      organizationId
    });
  }

  async cloneTool(
    id: string,
    organizationId: string,
    userId: string,
    options?: { name?: string; description?: string }
  ): Promise<Tool> {
    const originalTool = await this.getTool(id, organizationId);

    const clonedData = {
      name: options?.name || `${originalTool.name} (Copy)`,
      description: options?.description || originalTool.description,
      type: originalTool.type,
      inputSchema: originalTool.inputSchema,
      outputSchema: originalTool.outputSchema,
      code: originalTool.code,
      endpoint: originalTool.endpoint,
      authentication: originalTool.authentication,
      config: originalTool.config,
      category: originalTool.category,
      tags: originalTool.tags,
      metadata: {}
    };

    return this.createTool(userId, organizationId, clonedData);
  }

  async executeTool(
    id: string,
    organizationId: string,
    userId: string,
    data: z.infer<typeof ExecuteToolSchema>
  ): Promise<ToolExecution> {
    const validatedData = ExecuteToolSchema.parse(data);

    const tool = await this.getTool(id, organizationId);

    // Check rate limits
    if (tool.config && (tool.config as any).rateLimit) {
      await this.checkRateLimit(tool.id, (tool.config as any).rateLimit);
    }

    // Check cache if enabled
    if (validatedData.options.enableCache && (tool.config as any).cacheTtl) {
      const cachedResult = await this.getCachedResult(tool.id, validatedData.input);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Create execution record
    const execution = await this.prisma.toolExecution.create({
      data: {
        toolId: id,
        input: validatedData.input,
        status: ExecutionStatus.RUNNING,
        metadata: {
          context: validatedData.context,
          options: validatedData.options,
          userId,
          organizationId,
          toolType: tool.type,
          toolName: tool.name
        }
      }
    });

    // Execute tool asynchronously
    this.executeToolAsync(execution, tool, validatedData, userId, organizationId)
      .catch(error => {
        this.logger.error(`Tool execution failed: ${error.message}`, error.stack);
      });

    await this.apix.publishEvent('tool-events', {
      type: 'TOOL_EXECUTION_STARTED',
      toolId: id,
      executionId: execution.id,
      organizationId,
      data: execution
    });

    return execution;
  }

  private async executeToolAsync(
    execution: ToolExecution,
    tool: Tool,
    data: z.infer<typeof ExecuteToolSchema>,
    userId: string,
    organizationId: string
  ): Promise<void> {
    const startTime = Date.now();
    const context: ToolExecutionContext = {
      toolId: tool.id,
      executionId: execution.id,
      input: data.input,
      context: data.context,
      options: data.options,
      userId,
      organizationId,
      startTime
    };

    try {
      // Validate input if enabled
      if ((tool.config as any)?.validateInput && tool.inputSchema) {
        await this.validateInput(data.input, tool.inputSchema);
      }

      // Execute based on tool type
      let result: any;
      switch (tool.type) {
        case ToolType.FUNCTION_CALLER:
          result = await this.executeFunctionTool(tool, context);
          break;
        case ToolType.REST_API:
          result = await this.executeRestApiTool(tool, context);
          break;
        case ToolType.RAG_RETRIEVAL:
          result = await this.executeRagTool(tool, context);
          break;
        case ToolType.BROWSER_AUTOMATION:
          result = await this.executeBrowserTool(tool, context);
          break;
        case ToolType.DATABASE_QUERY:
          result = await this.executeDatabaseTool(tool, context);
          break;
        case ToolType.WEBHOOK:
          result = await this.executeWebhookTool(tool, context);
          break;
        case ToolType.FILE_PROCESSOR:
          result = await this.executeFileProcessorTool(tool, context);
          break;
        case ToolType.EMAIL_SENDER:
          result = await this.executeEmailTool(tool, context);
          break;
        case ToolType.SCHEDULER:
          result = await this.executeSchedulerTool(tool, context);
          break;
        case ToolType.CUSTOM_LOGIC:
          result = await this.executeCustomLogicTool(tool, context);
          break;
        default:
          throw new BadRequestException(`Unsupported tool type: ${tool.type}`);
      }

      // Validate output if enabled
      if ((tool.config as any)?.validateOutput && tool.outputSchema) {
        await this.validateOutput(result, tool.outputSchema);
      }

      const duration = Date.now() - startTime;

      // Update execution record
      await this.prisma.toolExecution.update({
        where: { id: execution.id },
        data: {
          output: result,
          status: ExecutionStatus.COMPLETED,
          duration,
          completedAt: new Date()
        }
      });

      // Cache result if enabled
      if (data.options.enableCache && (tool.config as any).cacheTtl) {
        await this.cacheResult(tool.id, data.input, result, (tool.config as any).cacheTtl);
      }

      // Update tool metrics
      await this.updateToolMetrics(tool.id, duration, true);

      await this.apix.publishEvent('tool-events', {
        type: 'TOOL_EXECUTION_COMPLETED',
        toolId: tool.id,
        executionId: execution.id,
        organizationId,
        data: {
          executionId: execution.id,
          duration,
          output: result,
          completedAt: new Date()
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      await this.prisma.toolExecution.update({
        where: { id: execution.id },
        data: {
          error: error.message,
          status: ExecutionStatus.FAILED,
          duration,
          completedAt: new Date()
        }
      });

      // Update tool metrics for failure
      await this.updateToolMetrics(tool.id, duration, false);

      await this.apix.publishEvent('tool-events', {
        type: 'TOOL_EXECUTION_FAILED',
        toolId: tool.id,
        executionId: execution.id,
        organizationId,
        data: {
          executionId: execution.id,
          duration,
          error: error.message,
          completedAt: new Date()
        }
      });
    }
  }

  // Tool type implementations
  private async executeFunctionTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    if (!tool.code) {
      throw new BadRequestException('Function tool requires code');
    }

    const sandbox = {
      input: context.input,
      context: context.context,
      console: {
        log: (...args: any[]) => this.logger.log(`Tool ${tool.id}:`, ...args),
        error: (...args: any[]) => this.logger.error(`Tool ${tool.id}:`, ...args)
      },
      require: (module: string) => {
        // Whitelist allowed modules
        const allowedModules = ['lodash', 'moment', 'crypto', 'uuid'];
        if (allowedModules.includes(module)) {
          return require(module);
        }
        throw new Error(`Module '${module}' is not allowed`);
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      JSON,
      Math,
      Date,
      RegExp,
      Array,
      Object,
      String,
      Number,
      Boolean
    };

    const timeout = (tool.config as any)?.timeout || 30000;

    try {
      const result = vm.runInNewContext(tool.code, sandbox, {
        timeout,
        displayErrors: true,
        contextName: `Tool-${tool.id}`
      });

      return result;
    } catch (error) {
      throw new BadRequestException(`Function execution failed: ${error.message}`);
    }
  }

  private async executeRestApiTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    if (!tool.endpoint) {
      throw new BadRequestException('REST API tool requires endpoint');
    }

    const config = tool.config as any;
    const auth = tool.authentication as any;

    const headers: any = {
      'Content-Type': 'application/json',
      ...config.customHeaders
    };

    // Add authentication
    switch (auth.type) {
      case 'api_key':
        headers[auth.headerName || 'X-API-Key'] = auth.apiKey;
        break;
      case 'bearer':
        headers.Authorization = `Bearer ${auth.token}`;
        break;
      case 'basic':
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
        break;
      case 'oauth':
        const token = await this.getOAuthToken(auth.oauth);
        headers.Authorization = `Bearer ${token}`;
        break;
    }

    const requestConfig = {
      method: config.method || 'POST',
      url: tool.endpoint,
      data: context.input,
      headers,
      timeout: config.timeout || 30000,
      maxRedirects: 5,
      validateStatus: (status: number) => status < 500
    };

    let retries = config.retries || 0;
    let lastError: any;

    while (retries >= 0) {
      try {
        const response = await axios(requestConfig);
        
        return {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: response.headers
        };
      } catch (error) {
        lastError = error;
        retries--;
        
        if (retries >= 0 && this.isRetryableError(error)) {
          await this.delay(Math.pow(2, config.retries - retries) * 1000); // Exponential backoff
          continue;
        }
        
        break;
      }
    }

    throw new BadRequestException(`REST API call failed: ${lastError.message}`);
  }

  private async executeRagTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    const config = tool.config as any;
    
    if (!config.knowledgeBaseId) {
      throw new BadRequestException('RAG tool requires knowledgeBaseId in config');
    }

    const query = context.input.query || context.input.question || JSON.stringify(context.input);
    
    // This would integrate with the knowledge service
    // For now, return mock results
    return {
      query,
      results: [
        {
          content: 'Mock search result content',
          score: 0.95,
          metadata: { source: 'document1.pdf', page: 1 }
        }
      ],
      totalResults: 1
    };
  }

  private async executeBrowserTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    const config = tool.config as any;
    
    if (!this.browserInstance) {
      await this.initializeBrowser();
    }

    const page = await this.browserInstance!.newPage();
    
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      
      const action = config.action || context.input.action;
      const url = config.url || context.input.url;

      switch (action) {
        case 'navigate':
          await page.goto(url, { waitUntil: 'networkidle2' });
          break;
          
        case 'screenshot':
          await page.goto(url, { waitUntil: 'networkidle2' });
          const screenshot = await page.screenshot({ 
            type: 'png', 
            fullPage: config.fullPage || false 
          });
          return {
            action: 'screenshot',
            url,
            screenshot: screenshot.toString('base64')
          };
          
        case 'extract_text':
          await page.goto(url, { waitUntil: 'networkidle2' });
          const text = await page.evaluate(() => document.body.innerText);
          return {
            action: 'extract_text',
            url,
            text
          };
          
        case 'click':
          await page.goto(url, { waitUntil: 'networkidle2' });
          await page.click(context.input.selector);
          break;
          
        case 'fill_form':
          await page.goto(url, { waitUntil: 'networkidle2' });
          for (const [selector, value] of Object.entries(context.input.formData)) {
            await page.fill(selector, value as string);
          }
          if (context.input.submitSelector) {
            await page.click(context.input.submitSelector);
          }
          break;
          
        default:
          throw new BadRequestException(`Unsupported browser action: ${action}`);
      }

      const finalUrl = page.url();
      const title = await page.title();

      return {
        action,
        url: finalUrl,
        title,
        success: true
      };

    } finally {
      await page.close();
    }
  }

  private async executeDatabaseTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    const config = tool.config as any;
    
    if (!config.connectionString && !config.database) {
      throw new BadRequestException('Database tool requires connection configuration');
    }

    // This would integrate with various databases
    // For now, return mock results
    return {
      query: config.query || context.input.query,
      parameters: context.input.parameters || {},
      results: [],
      rowCount: 0,
      executionTime: 0
    };
  }

  private async executeWebhookTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    if (!tool.endpoint) {
      throw new BadRequestException('Webhook tool requires endpoint');
    }

    const config = tool.config as any;
    const headers: any = {
      'Content-Type': 'application/json',
      'User-Agent': 'SynapseAI-Webhook/1.0',
      ...config.customHeaders
    };

    // Add webhook signature if configured
    if (config.secret) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', config.secret)
        .update(JSON.stringify(context.input))
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await axios({
      method: config.method || 'POST',
      url: tool.endpoint,
      data: {
        ...context.input,
        timestamp: new Date().toISOString(),
        toolId: tool.id,
        executionId: context.executionId
      },
      headers,
      timeout: config.timeout || 30000
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
      deliveredAt: new Date()
    };
  }

  private async executeFileProcessorTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    const config = tool.config as any;
    const action = config.action || context.input.action;

    switch (action) {
      case 'read':
        return this.readFile(context.input.filePath, config);
      case 'write':
        return this.writeFile(context.input.filePath, context.input.content, config);
      case 'parse_csv':
        return this.parseCsv(context.input.filePath || context.input.content, config);
      case 'parse_json':
        return this.parseJson(context.input.filePath || context.input.content, config);
      case 'convert':
        return this.convertFile(context.input.filePath, context.input.targetFormat, config);
      default:
        throw new BadRequestException(`Unsupported file action: ${action}`);
    }
  }

  private async executeEmailTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    const config = tool.config as any;
    
    // This would integrate with email services (SendGrid, AWS SES, etc.)
    // For now, return mock response
    return {
      messageId: `msg_${Date.now()}`,
      to: context.input.to,
      subject: context.input.subject,
      sent: true,
      sentAt: new Date()
    };
  }

  private async executeSchedulerTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    const config = tool.config as any;
    
    // This would integrate with scheduling systems
    // For now, return mock response
    return {
      scheduled: true,
      scheduleId: `sched_${Date.now()}`,
      scheduledFor: context.input.scheduledFor,
      action: context.input.action,
      createdAt: new Date()
    };
  }

  private async executeCustomLogicTool(tool: Tool, context: ToolExecutionContext): Promise<any> {
    // Custom logic tools can have various implementations
    const config = tool.config as any;
    
    switch (config.logicType) {
      case 'data_transformation':
        return this.executeDataTransformation(context.input, config);
      case 'validation':
        return this.executeValidation(context.input, config);
      case 'calculation':
        return this.executeCalculation(context.input, config);
      default:
        return this.executeFunctionTool(tool, context);
    }
  }

  // Helper methods
  private async validateToolConfiguration(tool: any): Promise<void> {
    switch (tool.type) {
      case ToolType.FUNCTION_CALLER:
        if (!tool.code) {
          throw new BadRequestException('Function caller tool requires code');
        }
        break;
        
      case ToolType.REST_API:
        if (!tool.endpoint) {
          throw new BadRequestException('REST API tool requires endpoint');
        }
        break;
        
      case ToolType.WEBHOOK:
        if (!tool.endpoint) {
          throw new BadRequestException('Webhook tool requires endpoint');
        }
        break;
        
      case ToolType.RAG_RETRIEVAL:
        if (!tool.config?.knowledgeBaseId) {
          throw new BadRequestException('RAG tool requires knowledgeBaseId in config');
        }
        break;
        
      case ToolType.DATABASE_QUERY:
        if (!tool.config?.connectionString && !tool.config?.database) {
          throw new BadRequestException('Database tool requires connection configuration');
        }
        break;
    }
  }

  private async validateInput(input: any, schema: any): Promise<void> {
    // Implement JSON schema validation
    // For now, just basic validation
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in input)) {
          throw new BadRequestException(`Required field '${field}' is missing`);
        }
      }
    }
  }

  private async validateOutput(output: any, schema: any): Promise<void> {
    // Implement JSON schema validation for output
    // For now, just basic validation
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in output)) {
          throw new BadRequestException(`Required output field '${field}' is missing`);
        }
      }
    }
  }

  private initializeRateLimiters(): void {
    // Initialize rate limiters for existing tools
    // This would be called on service startup
  }

  private initializeRateLimiter(toolId: string, rateLimit: number): void {
    // Simple rate limiter implementation
    this.rateLimiters.set(toolId, {
      requests: [],
      limit: rateLimit,
      window: 60000 // 1 minute window
    });
  }

  private async checkRateLimit(toolId: string, rateLimit: number): Promise<void> {
    const limiter = this.rateLimiters.get(toolId);
    if (!limiter) return;

    const now = Date.now();
    const windowStart = now - limiter.window;
    
    // Remove old requests
    limiter.requests = limiter.requests.filter((time: number) => time > windowStart);
    
    if (limiter.requests.length >= limiter.limit) {
      throw new BadRequestException('Rate limit exceeded');
    }
    
    limiter.requests.push(now);
  }

  private async getCachedResult(toolId: string, input: any): Promise<any> {
    const cacheKey = `${toolId}:${JSON.stringify(input)}`;
    return this.executionCache.get(cacheKey);
  }

  private async cacheResult(toolId: string, input: any, result: any, ttl: number): Promise<void> {
    const cacheKey = `${toolId}:${JSON.stringify(input)}`;
    this.executionCache.set(cacheKey, result);
    
    // Set expiration
    setTimeout(() => {
      this.executionCache.delete(cacheKey);
    }, ttl * 1000);
  }

  private async updateToolMetrics(toolId: string, duration: number, success: boolean): Promise<void> {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool) return;

    const metadata = tool.metadata as any;
    const totalExecutions = (metadata.totalExecutions || 0) + 1;
    const successfulExecutions = (metadata.successfulExecutions || 0) + (success ? 1 : 0);
    const failedExecutions = (metadata.failedExecutions || 0) + (success ? 0 : 1);
    const avgExecutionTime = ((metadata.avgExecutionTime || 0) * (totalExecutions - 1) + duration) / totalExecutions;
    const errorRate = (failedExecutions / totalExecutions) * 100;
    const popularityScore = this.calculatePopularityScore(totalExecutions, successfulExecutions, avgExecutionTime);

    await this.prisma.tool.update({
      where: { id: toolId },
      data: {
        metadata: {
          ...metadata,
          totalExecutions,
          successfulExecutions,
          failedExecutions,
          avgExecutionTime,
          errorRate,
          popularityScore,
          lastExecuted: new Date()
        }
      }
    });
  }

  private calculatePopularityScore(total: number, successful: number, avgTime: number): number {
    const successRate = successful / total;
    const speedScore = Math.max(0, 1 - (avgTime / 10000)); // Normalize to 10 seconds
    const usageScore = Math.min(1, total / 100); // Normalize to 100 executions
    
    return (successRate * 0.5 + speedScore * 0.3 + usageScore * 0.2) * 100;
  }

  private async initializeBrowser(): Promise<void> {
    try {
      this.browserInstance = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (error) {
      this.logger.warn('Failed to initialize browser for automation tools');
    }
  }

  private async getOAuthToken(oauthConfig: any): Promise<string> {
    // Implement OAuth token retrieval
    // For now, return mock token
    return 'mock_oauth_token';
  }

  private isRetryableError(error: any): boolean {
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 429; // Server errors or rate limiting
    }
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // File processing helpers
  private async readFile(filePath: string, config: any): Promise<any> {
    const fs = require('fs').promises;
    
    try {
      const content = await fs.readFile(filePath, config.encoding || 'utf8');
      return {
        filePath,
        content,
        size: content.length,
        readAt: new Date()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to read file: ${error.message}`);
    }
  }

  private async writeFile(filePath: string, content: string, config: any): Promise<any> {
    const fs = require('fs').promises;
    
    try {
      await fs.writeFile(filePath, content, config.encoding || 'utf8');
      return {
        filePath,
        size: content.length,
        writtenAt: new Date()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to write file: ${error.message}`);
    }
  }

  private async parseCsv(input: string, config: any): Promise<any> {
    const csv = require('csv-parser');
    const { Readable } = require('stream');
    
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from([input]);
      
      stream
        .pipe(csv(config.csvOptions || {}))
        .on('data', (data: any) => results.push(data))
        .on('end', () => resolve({
          rows: results,
          count: results.length,
          parsedAt: new Date()
        }))
        .on('error', reject);
    });
  }

  private async parseJson(input: string, config: any): Promise<any> {
    try {
      const data = JSON.parse(input);
      return {
        data,
        parsedAt: new Date()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to parse JSON: ${error.message}`);
    }
  }

  private async convertFile(filePath: string, targetFormat: string, config: any): Promise<any> {
    // File conversion logic would go here
    // For now, return mock response
    return {
      originalPath: filePath,
      convertedPath: filePath.replace(/\.[^.]+$/, `.${targetFormat}`),
      targetFormat,
      convertedAt: new Date()
    };
  }

  private async executeDataTransformation(input: any, config: any): Promise<any> {
    // Data transformation logic
    const transformations = config.transformations || [];
    let result = input;

    for (const transform of transformations) {
      switch (transform.type) {
        case 'map':
          result = result.map(transform.function);
          break;
        case 'filter':
          result = result.filter(transform.function);
          break;
        case 'reduce':
          result = result.reduce(transform.function, transform.initialValue);
          break;
      }
    }

    return result;
  }

  private async executeValidation(input: any, config: any): Promise<any> {
    const rules = config.validationRules || [];
    const errors: string[] = [];

    for (const rule of rules) {
      if (!this.validateRule(input, rule)) {
        errors.push(rule.message || `Validation failed for rule: ${rule.field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validatedAt: new Date()
    };
  }

  private validateRule(input: any, rule: any): boolean {
    const value = this.getNestedValue(input, rule.field);
    
    switch (rule.type) {
      case 'required':
        return value !== undefined && value !== null && value !== '';
      case 'min':
        return typeof value === 'number' && value >= rule.value;
      case 'max':
        return typeof value === 'number' && value <= rule.value;
      case 'pattern':
        return typeof value === 'string' && new RegExp(rule.pattern).test(value);
      default:
        return true;
    }
  }

  private async executeCalculation(input: any, config: any): Promise<any> {
    const formula = config.formula;
    const variables = { ...input, ...config.constants };

    try {
      const result = vm.runInNewContext(formula, variables, { timeout: 5000 });
      return {
        formula,
        variables,
        result,
        calculatedAt: new Date()
      };
    } catch (error) {
      throw new BadRequestException(`Calculation failed: ${error.message}`);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Analytics and reporting
  async getToolAnalytics(toolId: string, organizationId: string, timeRange: string): Promise<any> {
    const tool = await this.getTool(toolId, organizationId);

    const dateFilter = this.getDateFilter(timeRange);

    const [
      executionStats,
      performanceStats,
      errorAnalysis
    ] = await Promise.all([
      this.getExecutionStats(toolId, dateFilter),
      this.getPerformanceStats(toolId, dateFilter),
      this.getErrorAnalysis(toolId, dateFilter)
    ]);

    return {
      tool,
      executionStats,
      performanceStats,
      errorAnalysis,
      timeRange,
      generatedAt: new Date()
    };
  }

  private getDateFilter(timeRange: string): { gte: Date } {
    const now = new Date();
    let daysBack = 7;

    switch (timeRange) {
      case '1d': daysBack = 1; break;
      case '7d': daysBack = 7; break;
      case '30d': daysBack = 30; break;
      case '90d': daysBack = 90; break;
    }

    return {
      gte: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    };
  }

  private async getExecutionStats(toolId: string, dateFilter: any): Promise<any> {
    const executions = await this.prisma.toolExecution.findMany({
      where: {
        toolId,
        startedAt: dateFilter
      }
    });

    const total = executions.length;
    const successful = executions.filter(e => e.status === ExecutionStatus.COMPLETED).length;
    const failed = executions.filter(e => e.status === ExecutionStatus.FAILED).length;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0
    };
  }

  private async getPerformanceStats(toolId: string, dateFilter: any): Promise<any> {
    const executions = await this.prisma.toolExecution.findMany({
      where: {
        toolId,
        startedAt: dateFilter,
        duration: { not: null }
      }
    });

    const durations = executions.map(e => e.duration!);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    return {
      avgDuration,
      minDuration,
      maxDuration,
      totalExecutions: executions.length
    };
  }

  private async getErrorAnalysis(toolId: string, dateFilter: any): Promise<any[]> {
    const failedExecutions = await this.prisma.toolExecution.findMany({
      where: {
        toolId,
        startedAt: dateFilter,
        status: ExecutionStatus.FAILED
      }
    });

    const errorCounts = new Map<string, number>();

    failedExecutions.forEach(execution => {
      const error = execution.error || 'Unknown error';
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Execution management
  async getToolExecutions(
    toolId: string,
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: ExecutionStatus;
    }
  ): Promise<{ executions: ToolExecution[]; total: number }> {
    const tool = await this.getTool(toolId, organizationId);

    const where: any = { toolId };
    if (options?.status) {
      where.status = options.status;
    }

    const [executions, total] = await Promise.all([
      this.prisma.toolExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0
      }),
      this.prisma.toolExecution.count({ where })
    ]);

    return { executions, total };
  }

  async testTool(
    id: string,
    organizationId: string,
    userId: string,
    testInput: any
  ): Promise<any> {
    const tool = await this.getTool(id, organizationId);

    // Create a test execution
    const execution = await this.executeTool(id, organizationId, userId, {
      input: testInput,
      context: { test: true },
      options: { enableCache: false }
    });

    return {
      executionId: execution.id,
      status: execution.status,
      testInput,
      message: 'Test execution started. Check execution status for results.'
    };
  }

  // Additional methods for API controller
  async getTemplates(organizationId: string): Promise<any[]> {
    // Return predefined tool templates
    return [
      {
        id: 't1',
        name: 'API Caller',
        description: 'Make HTTP requests to external APIs with authentication and error handling',
        category: 'Communication',
        type: 'api',
        tags: ['api', 'http', 'rest'],
        popularity: 95,
        rating: 4.8,
        installs: 5420,
        author: 'SynapseAI',
        template: {
          name: 'API Caller',
          type: 'api',
          endpoint: 'https://api.example.com/endpoint',
          authentication: { type: 'api_key', headerName: 'X-API-Key' },
          config: { timeout: 30000, retries: 3 }
        }
      },
      {
        id: 't2',
        name: 'Data Processor',
        description: 'Process and transform data with validation and cleaning',
        category: 'Data Processing',
        type: 'function',
        tags: ['data', 'processing', 'validation'],
        popularity: 87,
        rating: 4.6,
        installs: 3210,
        author: 'Community',
        template: {
          name: 'Data Processor',
          type: 'function',
          code: `
function processData(input) {
  // Validate input
  if (!input.data) throw new Error('Data is required');
  
  // Process data
  const processed = input.data.map(item => ({
    ...item,
    processed: true,
    timestamp: new Date().toISOString()
  }));
  
  return { processed, count: processed.length };
}
          `.trim()
        }
      },
      {
        id: 't3',
        name: 'Web Scraper',
        description: 'Extract data from websites with browser automation',
        category: 'Web Scraping',
        type: 'browser',
        tags: ['scraping', 'web', 'automation'],
        popularity: 78,
        rating: 4.4,
        installs: 2150,
        author: 'SynapseAI',
        template: {
          name: 'Web Scraper',
          type: 'browser',
          config: {
            timeout: 60000,
            headless: true,
            viewport: { width: 1920, height: 1080 }
          }
        }
      }
    ];
  }

  async getExecutions(toolId: string, organizationId: string, limit: number = 50): Promise<any> {
    const executions = await this.prisma.toolExecution.findMany({
      where: {
        toolId,
        tool: { organizationId }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        tool: { select: { name: true } }
      }
    });

    return {
      executions: executions.map(execution => ({
        id: execution.id,
        status: execution.status,
        input: execution.input,
        output: execution.output,
        error: execution.error,
        startedAt: execution.createdAt,
        completedAt: execution.completedAt,
        duration: execution.duration,
        toolName: execution.tool.name
      })),
      total: executions.length
    };
  }

  async getPerformanceMetrics(toolId: string, organizationId: string): Promise<any> {
    const tool = await this.getTool(toolId, organizationId);
    
    const executions = await this.prisma.toolExecution.findMany({
      where: {
        toolId,
        tool: { organizationId }
      },
      select: {
        status: true,
        duration: true,
        createdAt: true
      }
    });

    const total = executions.length;
    const successful = executions.filter(e => e.status === 'COMPLETED').length;
    const failed = executions.filter(e => e.status === 'FAILED').length;
    const avgDuration = executions.reduce((sum, e) => sum + (e.duration || 0), 0) / total || 0;

    // Calculate usage over time periods
    const now = new Date();
    const today = executions.filter(e => 
      e.createdAt >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ).length;
    
    const thisWeek = executions.filter(e => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return e.createdAt >= weekAgo;
    }).length;

    const thisMonth = executions.filter(e => {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return e.createdAt >= monthAgo;
    }).length;

    return {
      usage: {
        today,
        week: thisWeek,
        month: thisMonth,
        total
      },
      performance: {
        successRate: total > 0 ? (successful / total) * 100 : 0,
        errorRate: total > 0 ? (failed / total) * 100 : 0,
        avgResponseTime: avgDuration / 1000 // Convert to seconds
      },
      status: tool.status,
      lastUsed: executions[0]?.createdAt || null
    };
  }
}