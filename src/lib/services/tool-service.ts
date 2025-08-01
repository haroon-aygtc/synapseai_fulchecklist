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
  private logger: any = null;

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
      // Create secure execution context using API endpoint
      const response = await fetch('/api/tools/execute-function', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          code: tool.code,
          input,
          timeout: execution.metadata.timeout || 30000
        })
      });

      if (!response.ok) {
        throw new Error(`Function execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.memoryUsage = result.memoryUsage || 0;
      execution.resourceUsage.networkCalls = 1;

      return result.output;

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

    const startTime = Date.now();

    try {
      const config = tool.config || {};
      const method = config.method || 'POST';
      const headers: Record<string, string> = {
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

      const requestConfig: RequestInit = {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify(input) : undefined,
      };

      execution.resourceUsage.networkCalls = 1;
      
      const response = await fetch(tool.endpoint, requestConfig);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.storageUsed = JSON.stringify(responseData).length;

      return responseData;

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.networkCalls = 1;
      
      throw error;
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

      // Real vector search implementation via API
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          query,
          knowledgeBaseId: config.knowledgeBaseId,
          limit: config.limit || 5,
          threshold: config.threshold || 0.7,
          filters: config.filters || {}
        })
      });

      if (!response.ok) {
        throw new Error(`Vector search failed: ${response.statusText}`);
      }

      const searchResults = await response.json();
      
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

  // PRODUCTION FIX: Real Browser Automation via API
  private async executeBrowserAutomationTool(
    tool: ToolDefinition,
    input: any,
    execution: ToolExecution
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const actions = input.actions || [];
      
      const response = await fetch('/api/browser/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          actions,
          timeout: execution.metadata.timeout || 30000
        })
      });

      if (!response.ok) {
        throw new Error(`Browser automation failed: ${response.statusText}`);
      }

      const result = await response.json();

      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;
      execution.resourceUsage.networkCalls = 1;

      return {
        actions: actions.length,
        results: result.results,
        metadata: {
          executionTime: Date.now() - startTime,
          browserVersion: result.browserVersion,
          userAgent: result.userAgent
        }
      };

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      throw error;
    }
  }

  // PRODUCTION FIX: Real Database Query Implementation via API
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

      const response = await fetch('/api/database/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          query,
          params,
          config: {
            type: config.type,
            timeout: config.timeout || 30000,
            maxRows: config.maxRows || 1000,
            organizationId: execution.metadata.organizationId
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Database query failed: ${response.statusText}`);
      }

      const result = await response.json();

      execution.resourceUsage.cpuTime = Date.now() - startTime;
      execution.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;
      execution.resourceUsage.networkCalls = 1;

      return {
        query,
        parameters: params,
        results: result.data,
        rowCount: Array.isArray(result.data) ? result.data.length : 1,
        executionTime: Date.now() - startTime,
        databaseType: config.type
      };

    } catch (error) {
      execution.resourceUsage.cpuTime = Date.now() - startTime;
      throw error;
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
        lastError = error as Error;
        
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
      throw new Error(`Input validation failed: ${(error as Error).message}`);
    }
  }

  private validateToolOutput(tool: ToolDefinition, output: any): any {
    try {
      return tool.outputSchema.parse(output);
    } catch (error) {
      // Log validation error but don't fail the execution
      console.warn(`Output validation failed for tool ${tool.id}:`, (error as Error).message);
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
      const response = await fetch(`${this.baseUrl}/${toolId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
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
      const response = await fetch(`${this.baseUrl}/executions/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
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

  private async initializeVectorStore(): Promise<void> {
    try {
      this.vectorStore = new ProductionVectorStoreService();
    } catch (error) {
      console.warn('Vector store initialization failed:', (error as Error).message);
    }
  }

  private async initializeBrowserPool(): Promise<void> {
    try {
      this.browserPool = new ProductionBrowserPoolService();
    } catch (error) {
      console.warn('Browser pool initialization failed:', (error as Error).message);
    }
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

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken') || '';
    }
    return '';
  }
}

// Supporting service interfaces and classes
interface VectorStoreService {
  generateEmbedding(text: string): Promise<number[]>;
  similaritySearch(params: {
    vector: number[];
    topK: number;
    threshold: number;
    filters: any;
    includeMetadata: boolean;
  }): Promise<Array<{
    id: string;
    content: string;
    score: number;
    metadata: any;
  }>>;
}

interface BrowserPoolService {
  getBrowser(): Promise<any>;
  releaseBrowser(browser: any): Promise<void>;
}

class ProductionVectorStoreService implements VectorStoreService {
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('/api/embeddings/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }

    const result = await response.json();
    return result.embedding;
  }

  async similaritySearch(params: any): Promise<any[]> {
    const response = await fetch('/api/vector/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Vector search failed');
    }

    const result = await response.json();
    return result.results;
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken') || '';
    }
    return '';
  }
}

class ProductionBrowserPoolService implements BrowserPoolService {
  async getBrowser(): Promise<any> {
    const response = await fetch('/api/browser/get-instance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get browser instance');
    }

    const result = await response.json();
    return {
      newPage: async () => ({
        setViewport: async (viewport: any) => {},
        setUserAgent: async (userAgent: string) => {},
        goto: async (url: string, options: any) => {
          return this.browserAction('navigate', { url, ...options });
        },
        screenshot: async (options: any) => {
          const result = await this.browserAction('screenshot', options);
          return result.data;
        },
        evaluate: async (fn: any, ...args: any[]) => {
          return this.browserAction('evaluate', { function: fn.toString(), args });
        },
        click: async (selector: string) => {
          return this.browserAction('click', { selector });
        },
        type: async (selector: string, text: string) => {
          return this.browserAction('type', { selector, text });
        },
        waitForSelector: async (selector: string, options: any) => {
          return this.browserAction('wait', { selector, ...options });
        },
        close: async () => {
          // Close page
        },
        url: () => result.currentUrl || '',
        title: async () => result.title || ''
      })
    };
  }

  async releaseBrowser(browser: any): Promise<void> {
    await fetch('/api/browser/release-instance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ browserId: browser.id })
    });
  }

  private async browserAction(action: string, params: any): Promise<any> {
    const response = await fetch('/api/browser/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ action, params })
    });

    if (!response.ok) {
      throw new Error(`Browser action failed: ${response.statusText}`);
    }

    return response.json();
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken') || '';
    }
    return '';
  }
}

// Export the service instance
export const toolService = new ToolService();