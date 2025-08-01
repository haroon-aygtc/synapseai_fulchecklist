import { z } from 'zod';

export interface ToolExecution {
  id: string;
  toolId: string;
  input: any;
  output?: any;
  error?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata: Record<string, any>;
  retryCount: number;
  resourceUsage: {
    memoryUsage: number;
    cpuTime: number;
    networkCalls: number;
    storageUsed: number;
  };
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  type: 'FUNCTION_CALLER' | 'REST_API' | 'RAG_RETRIEVAL' | 'BROWSER_AUTOMATION' | 'DATABASE_QUERY' | 'CUSTOM_LOGIC';
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
  code?: string;
  endpoint?: string;
  authentication?: Record<string, any>;
  config: Record<string, any>;
  version: number;
  isActive: boolean;
}

export interface ToolChainExecution {
  id: string;
  tools: string[];
  input: any;
  output?: any;
  executions: ToolExecution[];
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export class ToolService {
  private baseUrl = '/api/tools';
  private activeExecutions = new Map<string, ToolExecution>();
  private circuitBreakers = new Map<string, { failures: number; lastFailure: Date; isOpen: boolean }>();
  private performanceMetrics = new Map<string, { avgDuration: number; successRate: number; totalExecutions: number }>();
  private vectorStore: VectorStoreService | null = null;
  private browserPool: BrowserPoolService | null = null;

  constructor() {
    this.initializeToolService();
    this.initializeVectorStore();
    this.initializeBrowserPool();
  }

  // PRODUCTION FIX: Core Tool Execution with Real Implementation
  async executeTool(
    toolId: string,
    input: any,
    context?: {
      sessionId?: string;
      userId?: string;
      organizationId?: string;
      timeout?: number;
      retryPolicy?: {
        maxRetries: number;
        backoffStrategy: 'linear' | 'exponential';
        retryableErrors: string[];
      };
    }
  ): Promise<ToolExecution> {
    const executionId = this.generateId();
    
    const execution: ToolExecution = {
      id: executionId,
      toolId,
      input,
      status: 'PENDING',
      startedAt: new Date(),
      metadata: {
        sessionId: context?.sessionId,
        userId: context?.userId,
        organizationId: context?.organizationId,
        timeout: context?.timeout || 30000
      },
      retryCount: 0,
      resourceUsage: {
        memoryUsage: 0,
        cpuTime: 0,
        networkCalls: 0,
        storageUsed: 0
      }
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(toolId)) {
        throw new Error(`Circuit breaker is open for tool ${toolId}`);
      }

      // Get tool definition
      const tool = await this.getToolDefinition(toolId);
      if (!tool) {
        throw new Error(`Tool ${toolId} not found`);
      }

      if (!tool.isActive) {
        throw new Error(`Tool ${toolId} is not active`);
      }

      // Validate input
      const validatedInput = this.validateToolInput(tool, input);

      // Execute with retry logic
      const result = await this.executeWithRetry(tool, validatedInput, execution, context?.retryPolicy);

      // Validate output
      const validatedOutput = this.validateToolOutput(tool, result);

      execution.output = validatedOutput;
      execution.status = 'COMPLETED';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Update circuit breaker and metrics
      this.updateCircuitBreaker(toolId, true);
      this.updatePerformanceMetrics(toolId, execution);

      return execution;

    } catch (error) {
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.status = 'FAILED';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Update circuit breaker
      this.updateCircuitBreaker(toolId, false);
      this.updatePerformanceMetrics(toolId, execution);

      return execution;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  // Tool Chain Execution
  async executeToolChain(
    tools: string[],
    input: any,
    options?: {
      strategy: 'sequential' | 'parallel' | 'conditional';
      conditions?: Record<string, string>;
      errorHandling: 'stop' | 'continue' | 'retry';
      context?: any;
    }
  ): Promise<ToolChainExecution> {
    const chainId = this.generateId();
    
    const chainExecution: ToolChainExecution = {
      id: chainId,
      tools,
      input,
      executions: [],
      status: 'RUNNING',
      startedAt: new Date()
    };

    try {
      switch (options?.strategy || 'sequential') {
        case 'sequential':
          await this.executeSequentialChain(chainExecution, options);
          break;
        case 'parallel':
          await this.executeParallelChain(chainExecution, options);
          break;
        case 'conditional':
          await this.executeConditionalChain(chainExecution, options);
          break;
      }

      chainExecution.status = 'COMPLETED';
      chainExecution.output = this.aggregateChainResults(chainExecution.executions);

    } catch (error) {
      chainExecution.status = 'FAILED';
      chainExecution.output = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    chainExecution.completedAt = new Date();
    chainExecution.duration = chainExecution.completedAt.getTime() - chainExecution.startedAt.getTime();

    return chainExecution;
  }

  // Advanced Tool Execution Patterns
  private async executeSequentialChain(
    chainExecution: ToolChainExecution,
    options?: any
  ): Promise<void> {
    let currentInput = chainExecution.input;

    for (const toolId of chainExecution.tools) {
      const execution = await this.executeTool(toolId, currentInput, options?.context);
      chainExecution.executions.push(execution);

      if (execution.status === 'FAILED') {
        if (options?.errorHandling === 'stop') {
          throw new Error(`Tool chain failed at ${toolId}: ${execution.error}`);
        } else if (options?.errorHandling === 'retry') {
          // Retry the failed tool
          const retryExecution = await this.executeTool(toolId, currentInput, {
            ...options?.context,
            retryPolicy: { maxRetries: 3, backoffStrategy: 'exponential', retryableErrors: ['timeout', 'network'] }
          });
          chainExecution.executions.push(retryExecution);
          
          if (retryExecution.status === 'FAILED') {
            if (options?.errorHandling === 'stop') {
              throw new Error(`Tool chain failed after retry at ${toolId}: ${retryExecution.error}`);
            }
          } else {
            currentInput = retryExecution.output;
          }
        }
        // Continue with next tool if errorHandling is 'continue'
      } else {
        currentInput = execution.output;
      }
    }
  }

  private async executeParallelChain(
    chainExecution: ToolChainExecution,
    options?: any
  ): Promise<void> {
    const promises = chainExecution.tools.map(toolId =>
      this.executeTool(toolId, chainExecution.input, options?.context)
    );

    const executions = await Promise.allSettled(promises);
    
    chainExecution.executions = executions.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: this.generateId(),
          toolId: chainExecution.tools[index],
          input: chainExecution.input,
          error: result.reason?.message || 'Unknown error',
          status: 'FAILED' as const,
          startedAt: new Date(),
          completedAt: new Date(),
          metadata: {},
          retryCount: 0,
          resourceUsage: { memoryUsage: 0, cpuTime: 0, networkCalls: 0, storageUsed: 0 }
        };
      }
    });

    // Check if any critical tools failed
    const failedExecutions = chainExecution.executions.filter(e => e.status === 'FAILED');
    if (failedExecutions.length > 0 && options?.errorHandling === 'stop') {
      throw new Error(`Parallel chain failed: ${failedExecutions.map(e => e.error).join(', ')}`);
    }
  }

  private async executeConditionalChain(
    chainExecution: ToolChainExecution,
    options?: any
  ): Promise<void> {
    let currentInput = chainExecution.input;
    const conditions = options?.conditions || {};

    for (const toolId of chainExecution.tools) {
      // Check if tool should be executed based on conditions
      const condition = conditions[toolId];
      if (condition && !this.evaluateCondition(condition, currentInput)) {
        // Skip this tool
        continue;
      }

      const execution = await this.executeTool(toolId, currentInput, options?.context);
      chainExecution.executions.push(execution);

      if (execution.status === 'FAILED') {
        if (options?.errorHandling === 'stop') {
          throw new Error(`Conditional chain failed at ${toolId}: ${execution.error}`);
        }
      } else {
        currentInput = execution.output;
      }
    }
  }

  // Tool Type Implementations
  private async executeFunctionCallerTool(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution
  ): Promise<any> {
    if (!tool.code) {
      throw new Error('Function caller tool requires code');
    }

    const startTime = Date.now();
    
    try {
      // Create secure execution context
      const vm = require('vm');
      const sandbox = {
        input,
        output: null,
        console: {
          log: (...args: any[]) => console.log(`[Tool ${tool.id}]`, ...args),
          error: (...args: any[]) => console.error(`[Tool ${tool.id}]`, ...args)
        },
        require: (module: string) => {
          // Whitelist allowed modules
          const allowedModules = ['lodash', 'moment', 'axios', 'crypto'];
          if (allowedModules.includes(module)) {
            return require(module);
          }
          throw new Error(`Module ${module} is not allowed`);
        }
      };

      const context = vm.createContext(sandbox);
      const script = new vm.Script(tool.code);
      
      // Execute with timeout
      script.runInContext(context, {
        timeout: execution.metadata.timeout || 30000,
        displayErrors: true
      });

      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;

      return sandbox.output;

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      throw error;
    }
  }

  private async executeRestApiTool(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution
  ): Promise<any> {
    if (!tool.endpoint) {
      throw new Error('REST API tool requires endpoint');
    }

    const axios = require('axios');
    const startTime = Date.now();

    try {
      const config = tool.config || {};
      const method = config.method || 'POST';
      const headers = {
        'Content-Type': 'application/json',
        ...config.headers
      };

      // Add authentication
      if (tool.authentication) {
        if (tool.authentication.type === 'bearer') {
          headers['Authorization'] = `Bearer ${tool.authentication.token}`;
        } else if (tool.authentication.type === 'api_key') {
          headers[tool.authentication.header || 'X-API-Key'] = tool.authentication.key;
        }
      }

      const requestConfig = {
        method,
        url: tool.endpoint,
        headers,
        timeout: execution.metadata.timeout || 30000,
        data: method !== 'GET' ? input : undefined,
        params: method === 'GET' ? input : undefined
      };

      execution.resourceUsage.networkCalls = 1;
      
      const response = await axios(requestConfig);
      
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.storageUsed = JSON.stringify(response.data).length;

      return response.data;

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.networkCalls = 1;
      
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Network error: No response received');
      } else {
        throw error;
      }
    }
  }

  // PRODUCTION FIX: Real Vector Search Implementation
  private async executeRagRetrievalTool(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const config = tool.config as any;
      const query = input.query || input.text || JSON.stringify(input);
      
      if (!config.knowledgeBaseId) {
        throw new Error('Knowledge base ID is required for RAG retrieval');
      }

      // Real vector search implementation
      const searchResults = await this.performRealVectorSearch(query, config);
      
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;
      execution.resourceUsage.networkCalls = 1;

      return {
        query,
        results: searchResults.documents.map((doc: any, index: number) => ({
          content: doc.content,
          score: searchResults.scores[index],
          metadata: doc.metadata,
          source: doc.source
        })),
        totalResults: searchResults.documents.length,
        searchTime: Date.now() - startTime,
        knowledgeBaseId: config.knowledgeBaseId
      };

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      throw error;
    }
  }

  // PRODUCTION FIX: Real Browser Automation
  private async executeBrowserAutomationTool(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution
  ): Promise<any> {
    const startTime = Date.now();
    let browser = null;
    let page = null;

    try {
      const actions = input.actions || [];
      const results = [];

      // Get browser from pool or create new one
      browser = await this.getBrowserFromPool();
      page = await browser.newPage();

      // Set realistic viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      for (const action of actions) {
        const actionResult = await this.performRealBrowserAction(page, action);
        results.push(actionResult);
      }

      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;

      return {
        actions: actions.length,
        results,
        metadata: {
          executionTime: Date.now() - startTime,
          browserVersion: await browser.version(),
          userAgent: await page.evaluate(() => navigator.userAgent)
        }
      };

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      throw error;
    } finally {
      if (page) await page.close();
      if (browser) await this.returnBrowserToPool(browser);
    }
  }

  // PRODUCTION FIX: Real Database Query Implementation
  private async executeDatabaseQueryTool(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const config = tool.config as any;
      const query = input.query;
      const params = input.params || [];

      if (!query) {
        throw new Error('Database query tool requires query parameter');
      }

      if (!config.connectionString && !config.database) {
        throw new Error('Database connection configuration is required');
      }

      // Real database execution based on type
      let results;
      switch (config.type) {
        case 'postgresql':
          results = await this.executePostgreSQLQuery(config, query, params);
          break;
        case 'mysql':
          results = await this.executeMySQLQuery(config, query, params);
          break;
        case 'mongodb':
          results = await this.executeMongoDBQuery(config, query, params);
          break;
        case 'redis':
          results = await this.executeRedisQuery(config, query, params);
          break;
        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;
      execution.resourceUsage.networkCalls = 1;

      return {
        query,
        parameters: params,
        results: results.rows || results,
        rowCount: results.rowCount || (Array.isArray(results) ? results.length : 1),
        executionTime: Date.now() - startTime,
        databaseType: config.type
      };

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      throw error;
    }
  }

  // PRODUCTION FIX: Real Vector Search Implementation
  private async performRealVectorSearch(query: string, config: any): Promise<any> {
    try {
      // Initialize vector store if not already done
      if (!this.vectorStore) {
        await this.initializeVectorStore();
      }

      // Generate embeddings for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Perform similarity search
      const searchResults = await this.vectorStore!.similaritySearch(
        queryEmbedding,
        config.limit || 5,
        config.threshold || 0.7,
        {
          knowledgeBaseId: config.knowledgeBaseId,
          filters: config.filters || {}
        }
      );

      return searchResults;
    } catch (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }
  }

  // PRODUCTION FIX: Real Browser Action Implementation
  private async performRealBrowserAction(page: any, action: any): Promise<any> {
    const startTime = Date.now();

    try {
      switch (action.type) {
        case 'navigate':
          await page.goto(action.url, { 
            waitUntil: 'networkidle2',
            timeout: action.timeout || 30000
          });
          return {
            type: 'navigate',
            url: action.url,
            finalUrl: page.url(),
            title: await page.title(),
            success: true,
            duration: Date.now() - startTime
          };

        case 'click':
          await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
          await page.click(action.selector);
          return {
            type: 'click',
            selector: action.selector,
            success: true,
            duration: Date.now() - startTime
          };

        case 'type':
          await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
          await page.type(action.selector, action.text, { delay: action.delay || 50 });
          return {
            type: 'type',
            selector: action.selector,
            text: action.text,
            success: true,
            duration: Date.now() - startTime
          };

        case 'screenshot':
          const screenshot = await page.screenshot({
            type: action.format || 'png',
            fullPage: action.fullPage || false,
            quality: action.quality || 80
          });
          return {
            type: 'screenshot',
            screenshot: screenshot.toString('base64'),
            success: true,
            duration: Date.now() - startTime
          };

        case 'extract_text':
          const text = await page.evaluate((selector) => {
            if (selector) {
              const element = document.querySelector(selector);
              return element ? element.textContent : null;
            }
            return document.body.textContent;
          }, action.selector);
          return {
            type: 'extract_text',
            selector: action.selector,
            text,
            success: true,
            duration: Date.now() - startTime
          };

        case 'wait':
          if (action.selector) {
            await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
          } else {
            await page.waitForTimeout(action.duration || 1000);
          }
          return {
            type: 'wait',
            selector: action.selector,
            duration: action.duration,
            success: true,
            actualDuration: Date.now() - startTime
          };

        case 'evaluate':
          const result = await page.evaluate(action.script);
          return {
            type: 'evaluate',
            script: action.script,
            result,
            success: true,
            duration: Date.now() - startTime
          };

        default:
          throw new Error(`Unsupported browser action: ${action.type}`);
      }
    } catch (error) {
      return {
        type: action.type,
        error: error.message,
        success: false,
        duration: Date.now() - startTime
      };
    }
  }

  // PRODUCTION FIX: Real Database Query Implementations
  private async executePostgreSQLQuery(config: any, query: string, params: any[]): Promise<any> {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl || false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    try {
      const client = await pool.connect();
      const result = await client.query(query, params);
      client.release();
      return result;
    } finally {
      await pool.end();
    }
  }

  private async executeMySQLQuery(config: any, query: string, params: any[]): Promise<any> {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      port: config.port || 3306,
      ssl: config.ssl || false
    });

    try {
      const [rows, fields] = await connection.execute(query, params);
      return { rows, fields, rowCount: Array.isArray(rows) ? rows.length : 1 };
    } finally {
      await connection.end();
    }
  }

  private async executeMongoDBQuery(config: any, query: string, params: any[]): Promise<any> {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.connectionString);

    try {
      await client.connect();
      const db = client.db(config.database);
      const collection = db.collection(config.collection);

      // Parse query as MongoDB operation
      const operation = JSON.parse(query);
      let result;

      switch (operation.type) {
        case 'find':
          result = await collection.find(operation.filter || {}).limit(operation.limit || 100).toArray();
          break;
        case 'findOne':
          result = await collection.findOne(operation.filter || {});
          break;
        case 'insertOne':
          result = await collection.insertOne(operation.document);
          break;
        case 'updateOne':
          result = await collection.updateOne(operation.filter, operation.update);
          break;
        case 'deleteOne':
          result = await collection.deleteOne(operation.filter);
          break;
        case 'aggregate':
          result = await collection.aggregate(operation.pipeline).toArray();
          break;
        default:
          throw new Error(`Unsupported MongoDB operation: ${operation.type}`);
      }

      return { rows: result, rowCount: Array.isArray(result) ? result.length : 1 };
    } finally {
      await client.close();
    }
  }

  private async executeRedisQuery(config: any, query: string, params: any[]): Promise<any> {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: config.host,
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0
    });

    try {
      // Parse query as Redis command
      const command = JSON.parse(query);
      const result = await redis[command.operation](...(command.args || []));
      return { rows: [result], rowCount: 1 };
    } finally {
      redis.disconnect();
    }
  }

  // PRODUCTION FIX: Real Vector Store Implementation
  private async initializeVectorStore(): Promise<void> {
    try {
      this.vectorStore = new VectorStoreService({
        apiKey: process.env.VECTOR_DB_API_KEY,
        environment: process.env.VECTOR_DB_ENVIRONMENT,
        indexName: process.env.VECTOR_DB_INDEX
      });
      await this.vectorStore.initialize();
    } catch (error) {
      console.warn('Vector store initialization failed, using fallback:', error.message);
      // Fallback to in-memory vector store
      this.vectorStore = new InMemoryVectorStore();
    }
  }

  // PRODUCTION FIX: Real Browser Pool Implementation
  private async initializeBrowserPool(): Promise<void> {
    try {
      this.browserPool = new BrowserPoolService({
        maxBrowsers: 3,
        launchOptions: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });
      await this.browserPool.initialize();
    } catch (error) {
      console.warn('Browser pool initialization failed:', error.message);
    }
  }

  // Browser Pool Management
  private async getBrowserFromPool(): Promise<any> {
    if (this.browserPool) {
      return await this.browserPool.getBrowser();
    }
    
    // Fallback: create new browser
    const puppeteer = require('puppeteer');
    return await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  private async returnBrowserToPool(browser: any): Promise<void> {
    if (this.browserPool) {
      await this.browserPool.returnBrowser(browser);
    } else {
      await browser.close();
    }
  }

  // PRODUCTION FIX: Real Embedding Generation
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use OpenAI embeddings or local model
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-ada-002'
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding API failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  // Helper Methods
  private async executeWithRetry(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution,
    retryPolicy?: {
      maxRetries: number;
      backoffStrategy: 'linear' | 'exponential';
      retryableErrors: string[];
    }
  ): Promise<any> {
    const maxRetries = retryPolicy?.maxRetries || 0;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        execution.retryCount = attempt;
        return await this.executeToolByType(tool, input, execution);
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (retryPolicy && this.isRetryableError(error, retryPolicy.retryableErrors)) {
          if (attempt < maxRetries) {
            const delay = this.calculateRetryDelay(attempt, retryPolicy.backoffStrategy);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        throw error;
      }
    }

    throw lastError!;
  }

  private async executeToolByType(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution
  ): Promise<any> {
    execution.status = 'RUNNING';

    switch (tool.type) {
      case 'FUNCTION_CALLER':
        return this.executeFunctionCallerTool(tool, input, execution);
      case 'REST_API':
        return this.executeRestApiTool(tool, input, execution);
      case 'RAG_RETRIEVAL':
        return this.executeRagRetrievalTool(tool, input, execution);
      case 'BROWSER_AUTOMATION':
        return this.executeBrowserAutomationTool(tool, input, execution);
      case 'DATABASE_QUERY':
        return this.executeDatabaseQueryTool(tool, input, execution);
      case 'CUSTOM_LOGIC':
        return this.executeFunctionCallerTool(tool, input, execution); // Same as function caller
      default:
        throw new Error(`Unsupported tool type: ${tool.type}`);
    }
  }

  private validateToolInput(tool: ToolDefinition, input: any): any {
    try {
      return tool.inputSchema.parse(input);
    } catch (error) {
      throw new Error(`Input validation failed: ${error.message}`);
    }
  }

  private validateToolOutput(tool: ToolDefinition, output: any): any {
    try {
      return tool.outputSchema.parse(output);
    } catch (error) {
      // Log validation error but don't fail the execution
      console.warn(`Output validation failed for tool ${tool.id}:`, error.message);
      return output;
    }
  }

  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  private calculateRetryDelay(attempt: number, strategy: string): number {
    const baseDelay = 1000; // 1 second
    
    switch (strategy) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt);
      case 'linear':
      default:
        return baseDelay * (attempt + 1);
    }
  }

  // Circuit Breaker Implementation
  private isCircuitBreakerOpen(toolId: string): boolean {
    const breaker = this.circuitBreakers.get(toolId);
    if (!breaker) return false;

    if (breaker.isOpen) {
      // Check if enough time has passed to try again (half-open state)
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
      if (timeSinceLastFailure > 60000) { // 1 minute
        breaker.isOpen = false;
        breaker.failures = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  private updateCircuitBreaker(toolId: string, success: boolean): void {
    let breaker = this.circuitBreakers.get(toolId);
    if (!breaker) {
      breaker = { failures: 0, lastFailure: new Date(), isOpen: false };
      this.circuitBreakers.set(toolId, breaker);
    }

    if (success) {
      breaker.failures = 0;
      breaker.isOpen = false;
    } else {
      breaker.failures++;
      breaker.lastFailure = new Date();
      
      // Open circuit breaker after 5 consecutive failures
      if (breaker.failures >= 5) {
        breaker.isOpen = true;
      }
    }
  }

  // Performance Metrics
  private updatePerformanceMetrics(toolId: string, execution: ToolExecution): void {
    let metrics = this.performanceMetrics.get(toolId);
    if (!metrics) {
      metrics = { avgDuration: 0, successRate: 100, totalExecutions: 0 };
      this.performanceMetrics.set(toolId, metrics);
    }

    metrics.totalExecutions++;
    
    if (execution.duration) {
      metrics.avgDuration = ((metrics.avgDuration * (metrics.totalExecutions - 1)) + execution.duration) / metrics.totalExecutions;
    }

    const successCount = execution.status === 'COMPLETED' ? 1 : 0;
    metrics.successRate = ((metrics.successRate * (metrics.totalExecutions - 1)) + (successCount * 100)) / metrics.totalExecutions;
  }

  // Mock implementations for external services
  private async performVectorSearch(query: string, config: any): Promise<any[]> {
    // Mock vector search - replace with actual implementation
    return [
      { id: '1', content: 'Mock search result 1', score: 0.95 },
      { id: '2', content: 'Mock search result 2', score: 0.87 },
      { id: '3', content: 'Mock search result 3', score: 0.76 }
    ];
  }

  private async performBrowserAction(action: any): Promise<any> {
    // Mock browser action - replace with actual implementation
    return {
      action: action.type,
      target: action.target,
      result: 'success',
      data: action.type === 'screenshot' ? 'base64_image_data' : 'action_result'
    };
  }

  private async executeDbQuery(query: string, params: any[], config: any): Promise<any> {
    // Mock database query - replace with actual implementation
    return [
      { id: 1, name: 'Mock Result 1', value: 'data1' },
      { id: 2, name: 'Mock Result 2', value: 'data2' }
    ];
  }

  private evaluateCondition(condition: string, data: any): boolean {
    // Simple condition evaluation - replace with proper expression parser
    try {
      // Basic safety check
      if (condition.includes('eval') || condition.includes('Function')) {
        return false;
      }

      // Replace data references
      const safeCondition = condition.replace(/data\.(\w+)/g, (match, prop) => {
        return JSON.stringify(data[prop]);
      });

      return Function(`"use strict"; return (${safeCondition})`)();
    } catch (error) {
      console.warn('Condition evaluation failed:', error);
      return false;
    }
  }

  private aggregateChainResults(executions: ToolExecution[]): any {
    const results = executions.map(execution => ({
      toolId: execution.toolId,
      status: execution.status,
      output: execution.output,
      error: execution.error,
      duration: execution.duration
    }));

    const successfulResults = executions.filter(e => e.status === 'COMPLETED');
    const failedResults = executions.filter(e => e.status === 'FAILED');

    return {
      totalTools: executions.length,
      successful: successfulResults.length,
      failed: failedResults.length,
      results,
      aggregatedOutput: successfulResults.length > 0 ? 
        successfulResults.map(e => e.output) : 
        null
    };
  }

  // API Methods
  async getToolDefinition(toolId: string): Promise<ToolDefinition | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${toolId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get tool definition: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('Failed to get tool definition:', error);
      return null;
    }
  }

  async getToolExecution(executionId: string): Promise<ToolExecution | null> {
    try {
      const response = await fetch(`${this.baseUrl}/executions/${executionId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get tool execution: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('Failed to get tool execution:', error);
      return null;
    }
  }

  async getToolMetrics(toolId: string): Promise<any> {
    const metrics = this.performanceMetrics.get(toolId);
    const circuitBreaker = this.circuitBreakers.get(toolId);

    return {
      performance: metrics || { avgDuration: 0, successRate: 100, totalExecutions: 0 },
      circuitBreaker: circuitBreaker || { failures: 0, isOpen: false },
      lastUpdated: new Date()
    };
  }

  // Service Initialization
  private initializeToolService(): void {
    // Set up cleanup intervals
    setInterval(() => {
      this.cleanupOldExecutions();
    }, 300000); // 5 minutes

    setInterval(() => {
      this.resetCircuitBreakers();
    }, 3600000); // 1 hour
  }

  private cleanupOldExecutions(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [id, execution] of this.activeExecutions.entries()) {
      if (execution.startedAt.getTime() < cutoffTime) {
        this.activeExecutions.delete(id);
      }
    }
  }

  private resetCircuitBreakers(): void {
    for (const [toolId, breaker] of this.circuitBreakers.entries()) {
      if (breaker.isOpen) {
        const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
        if (timeSinceLastFailure > 3600000) { // 1 hour
          breaker.isOpen = false;
          breaker.failures = 0;
        }
      }
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// PRODUCTION FIX: Real Vector Store Service
class VectorStoreService {
  private config: any;
  private client: any;

  constructor(config: any) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize with actual vector database (Pinecone, Weaviate, etc.)
    const { PineconeClient } = require('@pinecone-database/pinecone');
    this.client = new PineconeClient();
    await this.client.init({
      apiKey: this.config.apiKey,
      environment: this.config.environment
    });
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit: number,
    threshold: number,
    options: any
  ): Promise<any> {
    const index = this.client.Index(this.config.indexName);
    
    const queryRequest = {
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      filter: options.filters
    };

    const queryResponse = await index.query({ queryRequest });
    
    return {
      documents: queryResponse.matches.map((match: any) => ({
        content: match.metadata.content,
        metadata: match.metadata,
        source: match.metadata.source
      })),
      scores: queryResponse.matches.map((match: any) => match.score)
    };
  }
}

// PRODUCTION FIX: Real Browser Pool Service
class BrowserPoolService {
  private browsers: any[] = [];
  private config: any;
  private maxBrowsers: number;

  constructor(config: any) {
    this.config = config;
    this.maxBrowsers = config.maxBrowsers || 3;
  }

  async initialize(): Promise<void> {
    const puppeteer = require('puppeteer');
    
    // Create initial browser pool
    for (let i = 0; i < this.maxBrowsers; i++) {
      const browser = await puppeteer.launch(this.config.launchOptions);
      this.browsers.push(browser);
    }
  }

  async getBrowser(): Promise<any> {
    if (this.browsers.length > 0) {
      return this.browsers.pop();
    }
    
    // Create new browser if pool is empty
    const puppeteer = require('puppeteer');
    return await puppeteer.launch(this.config.launchOptions);
  }

  async returnBrowser(browser: any): Promise<void> {
    if (this.browsers.length < this.maxBrowsers) {
      this.browsers.push(browser);
    } else {
      await browser.close();
    }
  }
}

// In-Memory Vector Store Fallback
class InMemoryVectorStore {
  private documents: any[] = [];

  async initialize(): Promise<void> {
    // Load documents from local storage or API
    try {
      const response = await fetch('/api/knowledge/documents');
      if (response.ok) {
        this.documents = await response.json();
      }
    } catch (error) {
      console.warn('Failed to load documents for in-memory vector store');
    }
  }

  async similaritySearch(queryEmbedding: number[], limit: number, threshold: number, options: any): Promise<any> {
    // Simple cosine similarity implementation
    const results = this.documents
      .map(doc => ({
        ...doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .filter(doc => doc.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      documents: results,
      scores: results.map(r => r.score)
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}