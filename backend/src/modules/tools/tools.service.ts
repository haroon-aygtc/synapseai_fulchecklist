import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { Tool, ToolType, ToolExecution, ExecutionStatus } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';
import { VM } from 'vm2';
import puppeteer from 'puppeteer';

const CreateToolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.nativeEnum(ToolType),
  inputSchema: z.record(z.any()).default({}),
  outputSchema: z.record(z.any()).default({}),
  code: z.string().optional(),
  endpoint: z.string().url().optional(),
  authentication: z.record(z.any()).default({}),
  config: z.record(z.any()).default({}),
  category: z.string().optional(),
  tags: z.array(z.string()).default([])
});

const UpdateToolSchema = CreateToolSchema.partial();

const ExecuteToolSchema = z.object({
  input: z.record(z.any()),
  context: z.record(z.any()).default({})
});

@Injectable()
export class ToolsService {
  private browser: puppeteer.Browser | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService
  ) {
    this.initializeBrowser();
  }

  private async initializeBrowser() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (error) {
      console.error('Failed to initialize browser:', error);
    }
  }

  async createTool(userId: string, organizationId: string, data: z.infer<typeof CreateToolSchema>): Promise<Tool> {
    const validatedData = CreateToolSchema.parse(data);

    // Validate tool configuration based on type
    this.validateToolConfig(validatedData);

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
          createdBy: userId,
          lastTested: null,
          executionCount: 0,
          avgExecutionTime: 0
        }
      }
    });

    await this.apix.publishEvent('tool-events', {
      type: 'TOOL_CREATED',
      toolId: tool.id,
      organizationId,
      data: tool
    });

    return tool;
  }

  async getTools(organizationId: string, filters?: {
    type?: ToolType;
    category?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<Tool[]> {
    const where: any = { organizationId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { hasSome: [filters.search] } }
      ];
    }

    return this.prisma.tool.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        executions: {
          take: 5,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            duration: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getTool(id: string, organizationId: string): Promise<Tool> {
    const tool = await this.prisma.tool.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
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

  async updateTool(id: string, organizationId: string, data: z.infer<typeof UpdateToolSchema>): Promise<Tool> {
    const validatedData = UpdateToolSchema.parse(data);

    const existingTool = await this.prisma.tool.findFirst({
      where: { id, organizationId }
    });

    if (!existingTool) {
      throw new NotFoundException('Tool not found');
    }

    if (validatedData.type || validatedData.config) {
      this.validateToolConfig({ ...existingTool, ...validatedData });
    }

    const tool = await this.prisma.tool.update({
      where: { id },
      data: {
        ...validatedData,
        version: existingTool.version + 1,
        updatedAt: new Date()
      }
    });

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

    await this.prisma.tool.delete({
      where: { id }
    });

    await this.apix.publishEvent('tool-events', {
      type: 'TOOL_DELETED',
      toolId: id,
      organizationId
    });
  }

  async executeTool(
    toolId: string,
    organizationId: string,
    data: z.infer<typeof ExecuteToolSchema>
  ): Promise<ToolExecution> {
    const validatedData = ExecuteToolSchema.parse(data);

    const tool = await this.getTool(toolId, organizationId);

    // Create execution record
    const execution = await this.prisma.toolExecution.create({
      data: {
        toolId,
        input: validatedData.input,
        status: ExecutionStatus.RUNNING,
        metadata: {
          context: validatedData.context,
          startedBy: 'system' // In real implementation, get from request context
        }
      }
    });

    try {
      await this.apix.publishEvent('tool-events', {
        type: 'TOOL_EXECUTION_STARTED',
        toolId,
        executionId: execution.id,
        organizationId
      });

      const startTime = Date.now();
      let output: any;

      switch (tool.type) {
        case ToolType.FUNCTION_CALLER:
          output = await this.executeFunctionCaller(tool, validatedData.input);
          break;
        case ToolType.REST_API:
          output = await this.executeRestApi(tool, validatedData.input);
          break;
        case ToolType.RAG_RETRIEVAL:
          output = await this.executeRagRetrieval(tool, validatedData.input);
          break;
        case ToolType.BROWSER_AUTOMATION:
          output = await this.executeBrowserAutomation(tool, validatedData.input);
          break;
        case ToolType.DATABASE_QUERY:
          output = await this.executeDatabaseQuery(tool, validatedData.input);
          break;
        case ToolType.CUSTOM_LOGIC:
          output = await this.executeCustomLogic(tool, validatedData.input);
          break;
        default:
          throw new BadRequestException(`Unsupported tool type: ${tool.type}`);
      }

      const duration = Date.now() - startTime;

      const completedExecution = await this.prisma.toolExecution.update({
        where: { id: execution.id },
        data: {
          output,
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
          duration
        }
      });

      // Update tool metadata
      await this.updateToolMetadata(toolId, duration);

      await this.apix.publishEvent('tool-events', {
        type: 'TOOL_EXECUTION_COMPLETED',
        toolId,
        executionId: execution.id,
        organizationId,
        output,
        duration
      });

      return completedExecution;

    } catch (error) {
      const failedExecution = await this.prisma.toolExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: error.message,
          completedAt: new Date(),
          duration: Date.now() - execution.startedAt.getTime()
        }
      });

      await this.apix.publishEvent('tool-events', {
        type: 'TOOL_EXECUTION_FAILED',
        toolId,
        executionId: execution.id,
        organizationId,
        error: error.message
      });

      throw error;
    }
  }

  private async executeFunctionCaller(tool: Tool, input: any): Promise<any> {
    if (!tool.code) {
      throw new BadRequestException('Function caller tool requires code');
    }

    const vm = new VM({
      timeout: 30000, // 30 seconds
      sandbox: {
        input,
        console: {
          log: (...args: any[]) => console.log('[Tool]', ...args)
        },
        require: (module: string) => {
          // Whitelist allowed modules
          const allowedModules = ['lodash', 'moment', 'crypto'];
          if (allowedModules.includes(module)) {
            return require(module);
          }
          throw new Error(`Module '${module}' is not allowed`);
        }
      }
    });

    try {
      const result = vm.run(`
        (function() {
          ${tool.code}
          if (typeof execute === 'function') {
            return execute(input);
          } else {
            throw new Error('Tool code must export an execute function');
          }
        })()
      `);

      return result;
    } catch (error) {
      throw new BadRequestException(`Function execution failed: ${error.message}`);
    }
  }

  private async executeRestApi(tool: Tool, input: any): Promise<any> {
    if (!tool.endpoint) {
      throw new BadRequestException('REST API tool requires endpoint');
    }

    const config = tool.config as any;
    const auth = tool.authentication as any;

    const axiosConfig: any = {
      method: config.method || 'GET',
      url: tool.endpoint,
      timeout: config.timeout || 30000
    };

    // Handle authentication
    if (auth.type === 'bearer') {
      axiosConfig.headers = {
        'Authorization': `Bearer ${auth.token}`
      };
    } else if (auth.type === 'apikey') {
      axiosConfig.headers = {
        [auth.headerName || 'X-API-Key']: auth.apiKey
      };
    } else if (auth.type === 'basic') {
      axiosConfig.auth = {
        username: auth.username,
        password: auth.password
      };
    }

    // Handle request body/params
    if (config.method === 'GET' || config.method === 'DELETE') {
      axiosConfig.params = input;
    } else {
      axiosConfig.data = input;
    }

    try {
      const response = await axios(axiosConfig);
      return {
        status: response.status,
        headers: response.headers,
        data: response.data
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  private async executeRagRetrieval(tool: Tool, input: any): Promise<any> {
    // This would integrate with a vector database like Pinecone, Weaviate, or Chroma
    // For now, implementing a basic search functionality
    const config = tool.config as any;
    const query = input.query || input.text || '';

    if (!query) {
      throw new BadRequestException('RAG retrieval requires a query');
    }

    // In a real implementation, this would:
    // 1. Convert query to embeddings
    // 2. Search vector database
    // 3. Return relevant documents with scores

    return {
      query,
      results: [
        {
          id: 'doc1',
          content: 'Sample document content that matches the query',
          score: 0.95,
          metadata: {
            source: 'knowledge_base',
            timestamp: new Date().toISOString()
          }
        }
      ],
      totalResults: 1
    };
  }

  private async executeBrowserAutomation(tool: Tool, input: any): Promise<any> {
    if (!this.browser) {
      throw new BadRequestException('Browser automation not available');
    }

    const config = tool.config as any;
    const page = await this.browser.newPage();

    try {
      const actions = input.actions || [];
      const results: any[] = [];

      for (const action of actions) {
        switch (action.type) {
          case 'navigate':
            await page.goto(action.url);
            results.push({ type: 'navigate', success: true, url: action.url });
            break;

          case 'click':
            await page.click(action.selector);
            results.push({ type: 'click', success: true, selector: action.selector });
            break;

          case 'type':
            await page.type(action.selector, action.text);
            results.push({ type: 'type', success: true, selector: action.selector });
            break;

          case 'screenshot':
            const screenshot = await page.screenshot({ encoding: 'base64' });
            results.push({ type: 'screenshot', success: true, data: screenshot });
            break;

          case 'extract':
            const content = await page.$eval(action.selector, el => el.textContent);
            results.push({ type: 'extract', success: true, content });
            break;

          default:
            results.push({ type: action.type, success: false, error: 'Unknown action type' });
        }
      }

      return { results };

    } finally {
      await page.close();
    }
  }

  private async executeDatabaseQuery(tool: Tool, input: any): Promise<any> {
    // This would connect to various databases (PostgreSQL, MySQL, MongoDB, etc.)
    // For security, we'd use connection pooling and parameterized queries
    const config = tool.config as any;
    const query = input.query;

    if (!query) {
      throw new BadRequestException('Database query tool requires a query');
    }

    // In a real implementation, this would:
    // 1. Validate the query for safety
    // 2. Connect to the specified database
    // 3. Execute the query with proper error handling
    // 4. Return results in a standardized format

    return {
      query,
      results: [],
      rowCount: 0,
      executionTime: 0
    };
  }

  private async executeCustomLogic(tool: Tool, input: any): Promise<any> {
    // Similar to function caller but with more advanced capabilities
    return this.executeFunctionCaller(tool, input);
  }

  private validateToolConfig(tool: any): void {
    switch (tool.type) {
      case ToolType.REST_API:
        if (!tool.endpoint) {
          throw new BadRequestException('REST API tool requires endpoint');
        }
        break;

      case ToolType.FUNCTION_CALLER:
      case ToolType.CUSTOM_LOGIC:
        if (!tool.code) {
          throw new BadRequestException('Function caller tool requires code');
        }
        break;

      case ToolType.DATABASE_QUERY:
        if (!tool.config?.connectionString) {
          throw new BadRequestException('Database query tool requires connection configuration');
        }
        break;
    }
  }

  private async updateToolMetadata(toolId: string, executionTime: number): Promise<void> {
    const tool = await this.prisma.tool.findUnique({
      where: { id: toolId },
      select: { metadata: true }
    });

    if (tool) {
      const metadata = tool.metadata as any;
      const executionCount = (metadata.executionCount || 0) + 1;
      const avgExecutionTime = metadata.avgExecutionTime || 0;
      const newAvgExecutionTime = (avgExecutionTime * (executionCount - 1) + executionTime) / executionCount;

      await this.prisma.tool.update({
        where: { id: toolId },
        data: {
          metadata: {
            ...metadata,
            executionCount,
            avgExecutionTime: newAvgExecutionTime,
            lastTested: new Date().toISOString()
          }
        }
      });
    }
  }

  async testTool(toolId: string, organizationId: string, testInput: any): Promise<any> {
    const tool = await this.getTool(toolId, organizationId);

    // Create a test execution (not stored in database)
    try {
      const startTime = Date.now();
      let output: any;

      switch (tool.type) {
        case ToolType.FUNCTION_CALLER:
          output = await this.executeFunctionCaller(tool, testInput);
          break;
        case ToolType.REST_API:
          output = await this.executeRestApi(tool, testInput);
          break;
        default:
          throw new BadRequestException(`Testing not supported for tool type: ${tool.type}`);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        output,
        duration,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getToolCategories(organizationId: string): Promise<string[]> {
    const tools = await this.prisma.tool.findMany({
      where: { organizationId },
      select: { category: true },
      distinct: ['category']
    });

    return tools
      .map(tool => tool.category)
      .filter(category => category !== null) as string[];
  }

  async getToolAnalytics(toolId: string, organizationId: string): Promise<any> {
    const tool = await this.getTool(toolId, organizationId);

    const totalExecutions = await this.prisma.toolExecution.count({
      where: { toolId }
    });

    const successfulExecutions = await this.prisma.toolExecution.count({
      where: { toolId, status: ExecutionStatus.COMPLETED }
    });

    const avgDuration = await this.prisma.toolExecution.aggregate({
      where: { toolId, status: ExecutionStatus.COMPLETED },
      _avg: { duration: true }
    });

    const recentExecutions = await this.prisma.toolExecution.findMany({
      where: { toolId },
      orderBy: { startedAt: 'desc' },
      take: 10
    });

    return {
      tool,
      totalExecutions,
      successfulExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      avgDuration: avgDuration._avg.duration || 0,
      recentExecutions
    };
  }
}