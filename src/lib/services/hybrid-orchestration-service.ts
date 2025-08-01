import { z } from 'zod';
import { toolService } from './tool-service';
import { agentService } from './agent-service';

// Hybrid Node Types
export interface HybridNode {
  id: string;
  type: 'agent' | 'tool' | 'hybrid' | 'condition' | 'loop' | 'human_input' | 'transformer';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  inputs: Array<{ id: string; name: string; type: string; required: boolean }>;
  outputs: Array<{ id: string; name: string; type: string }>;
}

export interface HybridExecution {
  id: string;
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  input: any;
  output?: any;
  error?: string;
  nodeExecutions: Map<string, NodeExecution>;
  context: ExecutionContext;
  metadata: {
    userId: string;
    organizationId: string;
    sessionId?: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
  };
}

export interface NodeExecution {
  nodeId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  input: any;
  output?: any;
  error?: string;
  retryCount: number;
  resourceUsage: {
    memoryUsage: number;
    cpuTime: number;
    networkCalls: number;
  };
}

export interface ExecutionContext {
  sessionId: string;
  variables: Map<string, any>;
  memory: Map<string, any>;
  agentStates: Map<string, any>;
  toolStates: Map<string, any>;
  humanInputs: Map<string, any>;
  metadata: Record<string, any>;
}

export interface HybridWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: HybridNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    condition?: string;
  }>;
  triggers: Array<{
    type: 'manual' | 'scheduled' | 'webhook' | 'event';
    config: Record<string, any>;
  }>;
  settings: {
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffStrategy: 'linear' | 'exponential';
    };
    errorHandling: 'stop' | 'continue' | 'retry';
    parallelism: number;
  };
}

export class HybridOrchestrationService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  private activeExecutions = new Map<string, HybridExecution>();
  private executionQueue: Array<{ execution: HybridExecution; priority: number }> = [];
  private isProcessingQueue = false;
  private wsConnection: WebSocket | null = null;
  private eventSubscribers = new Map<string, Set<(event: any) => void>>();

  constructor() {
    this.initializeWebSocketConnection();
    this.startExecutionProcessor();
  }

  // PRODUCTION: Real Hybrid Workflow Execution
  async executeHybridWorkflow(
    workflowId: string,
    input: any,
    options: {
      sessionId?: string;
      userId: string;
      organizationId: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      timeout?: number;
      context?: Record<string, any>;
    }
  ): Promise<HybridExecution> {
    try {
      // Get workflow definition
      const workflow = await this.getWorkflowDefinition(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Create execution context
      const executionId = this.generateExecutionId();
      const sessionId = options.sessionId || this.generateSessionId();
      
      const execution: HybridExecution = {
        id: executionId,
        workflowId,
        status: 'PENDING',
        startedAt: new Date(),
        input,
        nodeExecutions: new Map(),
        context: {
          sessionId,
          variables: new Map(),
          memory: new Map(),
          agentStates: new Map(),
          toolStates: new Map(),
          humanInputs: new Map(),
          metadata: options.context || {}
        },
        metadata: {
          userId: options.userId,
          organizationId: options.organizationId,
          sessionId,
          priority: options.priority || 'normal'
        }
      };

      // Store execution
      this.activeExecutions.set(executionId, execution);

      // Validate workflow
      const validationResult = await this.validateWorkflow(workflow);
      if (!validationResult.valid) {
        execution.status = 'FAILED';
        execution.error = `Workflow validation failed: ${validationResult.errors.join(', ')}`;
        execution.completedAt = new Date();
        return execution;
      }

      // Add to execution queue
      const priority = this.getPriorityValue(options.priority || 'normal');
      this.executionQueue.push({ execution, priority });
      this.executionQueue.sort((a, b) => b.priority - a.priority);

      // Notify via WebSocket
      this.emitExecutionEvent('execution_started', {
        executionId,
        workflowId,
        status: 'PENDING'
      });

      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this.processExecutionQueue();
      }

      return execution;

    } catch (error) {
      console.error('Hybrid workflow execution failed:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Node Execution Engine
  private async executeWorkflowNodes(
    workflow: HybridWorkflow,
    execution: HybridExecution
  ): Promise<void> {
    execution.status = 'RUNNING';
    
    try {
      // Find entry nodes (nodes with no incoming edges)
      const entryNodes = this.findEntryNodes(workflow);
      
      if (entryNodes.length === 0) {
        throw new Error('No entry nodes found in workflow');
      }

      // Execute nodes using topological sort
      const executionOrder = this.getExecutionOrder(workflow);
      const completedNodes = new Set<string>();
      const runningNodes = new Set<string>();

      for (const nodeId of executionOrder) {
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        // Check if all dependencies are completed
        const dependencies = this.getNodeDependencies(workflow, nodeId);
        const allDependenciesCompleted = dependencies.every(depId => 
          completedNodes.has(depId)
        );

        if (!allDependenciesCompleted) {
          continue;
        }

        // Execute node
        runningNodes.add(nodeId);
        
        try {
          const nodeExecution = await this.executeNode(
            node,
            execution,
            this.getNodeInput(workflow, node, execution)
          );

          execution.nodeExecutions.set(nodeId, nodeExecution);

          if (nodeExecution.status === 'COMPLETED') {
            completedNodes.add(nodeId);
            
            // Update execution context with node output
            this.updateExecutionContext(execution, node, nodeExecution.output);
          } else if (nodeExecution.status === 'FAILED') {
            if (workflow.settings.errorHandling === 'stop') {
              throw new Error(`Node ${nodeId} failed: ${nodeExecution.error}`);
            }
          }

        } catch (error) {
          const nodeExecution: NodeExecution = {
            nodeId,
            status: 'FAILED',
            startedAt: new Date(),
            completedAt: new Date(),
            input: this.getNodeInput(workflow, node, execution),
            error: error instanceof Error ? error.message : 'Unknown error',
            retryCount: 0,
            resourceUsage: { memoryUsage: 0, cpuTime: 0, networkCalls: 0 }
          };

          execution.nodeExecutions.set(nodeId, nodeExecution);

          if (workflow.settings.errorHandling === 'stop') {
            throw error;
          }
        } finally {
          runningNodes.delete(nodeId);
        }

        // Emit progress event
        this.emitExecutionEvent('node_completed', {
          executionId: execution.id,
          nodeId,
          status: execution.nodeExecutions.get(nodeId)?.status
        });
      }

      // Check if execution completed successfully
      const failedNodes = Array.from(execution.nodeExecutions.values())
        .filter(ne => ne.status === 'FAILED');

      if (failedNodes.length > 0 && workflow.settings.errorHandling === 'stop') {
        execution.status = 'FAILED';
        execution.error = `${failedNodes.length} nodes failed`;
      } else {
        execution.status = 'COMPLETED';
        execution.output = this.aggregateWorkflowOutput(execution);
      }

    } catch (error) {
      execution.status = 'FAILED';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Emit completion event
      this.emitExecutionEvent('execution_completed', {
        executionId: execution.id,
        status: execution.status,
        duration: execution.duration
      });
    }
  }

  // PRODUCTION: Real Node Execution by Type
  private async executeNode(
    node: HybridNode,
    execution: HybridExecution,
    input: any
  ): Promise<NodeExecution> {
    const nodeExecution: NodeExecution = {
      nodeId: node.id,
      status: 'RUNNING',
      startedAt: new Date(),
      input,
      retryCount: 0,
      resourceUsage: { memoryUsage: 0, cpuTime: 0, networkCalls: 0 }
    };

    const startTime = Date.now();

    try {
      let output: any;

      switch (node.type) {
        case 'agent':
          output = await this.executeAgentNode(node, input, execution);
          break;
        case 'tool':
          output = await this.executeToolNode(node, input, execution);
          break;
        case 'hybrid':
          output = await this.executeHybridNode(node, input, execution);
          break;
        case 'condition':
          output = await this.executeConditionNode(node, input, execution);
          break;
        case 'loop':
          output = await this.executeLoopNode(node, input, execution);
          break;
        case 'human_input':
          output = await this.executeHumanInputNode(node, input, execution);
          break;
        case 'transformer':
          output = await this.executeTransformerNode(node, input, execution);
          break;
        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      nodeExecution.status = 'COMPLETED';
      nodeExecution.output = output;

    } catch (error) {
      nodeExecution.status = 'FAILED';
      nodeExecution.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      nodeExecution.completedAt = new Date();
      nodeExecution.duration = Date.now() - startTime;
      nodeExecution.resourceUsage.cpuTime = nodeExecution.duration;
      nodeExecution.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;
    }

    return nodeExecution;
  }

  // PRODUCTION: Agent Node Execution
  private async executeAgentNode(
    node: HybridNode,
    input: any,
    execution: HybridExecution
  ): Promise<any> {
    const agentId = node.config.agentId;
    if (!agentId) {
      throw new Error('Agent node requires agentId in config');
    }

    // Get agent memory from execution context
    const agentMemory = execution.context.agentStates.get(agentId) || {};

    // Execute agent with context
    const result = await agentService.executeWithProvider(agentId, input, {
      sessionId: execution.context.sessionId,
      timeout: node.config.timeout || 30000,
      streaming: node.config.streaming || false,
      preferredProvider: node.config.preferredProvider
    });

    // Update agent state in context
    execution.context.agentStates.set(agentId, {
      ...agentMemory,
      lastExecution: result,
      lastExecutionTime: new Date()
    });

    return {
      content: result.content,
      usage: result.usage,
      provider: result.provider,
      agentId,
      executionTime: result.metadata?.executionTime
    };
  }

  // PRODUCTION: Tool Node Execution
  private async executeToolNode(
    node: HybridNode,
    input: any,
    execution: HybridExecution
  ): Promise<any> {
    const toolId = node.config.toolId;
    if (!toolId) {
      throw new Error('Tool node requires toolId in config');
    }

    // Execute tool with context
    const result = await toolService.executeTool(toolId, input, {
      sessionId: execution.context.sessionId,
      userId: execution.metadata.userId,
      organizationId: execution.metadata.organizationId,
      timeout: node.config.timeout || 30000,
      retryPolicy: node.config.retryPolicy
    });

    // Update tool state in context
    execution.context.toolStates.set(toolId, {
      lastExecution: result,
      lastExecutionTime: new Date()
    });

    return {
      output: result.output,
      status: result.status,
      duration: result.duration,
      toolId,
      resourceUsage: result.resourceUsage
    };
  }

  // PRODUCTION: Hybrid Node Execution (Agent + Tool coordination)
  private async executeHybridNode(
    node: HybridNode,
    input: any,
    execution: HybridExecution
  ): Promise<any> {
    const { agentId, toolIds, strategy } = node.config;
    
    if (!agentId || !toolIds || !Array.isArray(toolIds)) {
      throw new Error('Hybrid node requires agentId and toolIds array in config');
    }

    switch (strategy) {
      case 'agent_first':
        return this.executeAgentFirstStrategy(agentId, toolIds, input, execution);
      case 'tool_first':
        return this.executeToolFirstStrategy(agentId, toolIds, input, execution);
      case 'parallel':
        return this.executeParallelStrategy(agentId, toolIds, input, execution);
      case 'coordinated':
        return this.executeCoordinatedStrategy(agentId, toolIds, input, execution);
      default:
        throw new Error(`Unsupported hybrid strategy: ${strategy}`);
    }
  }

  // PRODUCTION: Agent-First Hybrid Strategy
  private async executeAgentFirstStrategy(
    agentId: string,
    toolIds: string[],
    input: any,
    execution: HybridExecution
  ): Promise<any> {
    // First, let agent analyze and decide which tools to use
    const agentResult = await agentService.executeWithProvider(agentId, {
      input,
      availableTools: toolIds,
      instruction: 'Analyze the input and determine which tools to use and in what order'
    }, {
      sessionId: execution.context.sessionId
    });

    // Parse agent's tool selection
    const toolPlan = this.parseToolPlan(agentResult.content);
    
    // Execute tools based on agent's plan
    const toolResults = [];
    for (const toolStep of toolPlan) {
      const toolResult = await toolService.executeTool(
        toolStep.toolId,
        toolStep.input,
        {
          sessionId: execution.context.sessionId,
          userId: execution.metadata.userId,
          organizationId: execution.metadata.organizationId
        }
      );
      toolResults.push(toolResult);
    }

    // Let agent synthesize final result
    const finalResult = await agentService.executeWithProvider(agentId, {
      originalInput: input,
      toolResults,
      instruction: 'Synthesize the tool results into a final response'
    }, {
      sessionId: execution.context.sessionId
    });

    return {
      strategy: 'agent_first',
      agentAnalysis: agentResult.content,
      toolResults,
      finalResult: finalResult.content,
      totalDuration: toolResults.reduce((sum, r) => sum + (r.duration || 0), 0)
    };
  }

  // PRODUCTION: Human Input Node Execution
  private async executeHumanInputNode(
    node: HybridNode,
    input: any,
    execution: HybridExecution
  ): Promise<any> {
    const { prompt, timeout, required } = node.config;
    
    // Create human input request
    const inputRequest = {
      id: this.generateId(),
      nodeId: node.id,
      executionId: execution.id,
      prompt: prompt || 'Human input required',
      input,
      timeout: timeout || 300000, // 5 minutes default
      required: required !== false,
      createdAt: new Date()
    };

    // Store in execution context
    execution.context.humanInputs.set(node.id, inputRequest);

    // Emit human input request event
    this.emitExecutionEvent('human_input_required', {
      executionId: execution.id,
      nodeId: node.id,
      request: inputRequest
    });

    // Wait for human input with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (required !== false) {
          reject(new Error('Human input timeout'));
        } else {
          resolve({ skipped: true, reason: 'timeout' });
        }
      }, inputRequest.timeout);

      // Subscribe to human input response
      const unsubscribe = this.subscribeToEvent('human_input_response', (event) => {
        if (event.nodeId === node.id && event.executionId === execution.id) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve({
            userInput: event.response,
            providedAt: new Date(),
            userId: event.userId
          });
        }
      });
    });
  }

  // Helper Methods
  private async getWorkflowDefinition(workflowId: string): Promise<HybridWorkflow | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get workflow: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get workflow definition:', error);
      return null;
    }
  }

  private async validateWorkflow(workflow: HybridWorkflow): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for cycles
    if (this.hasCycles(workflow)) {
      errors.push('Workflow contains cycles');
    }

    // Check for disconnected nodes
    const disconnectedNodes = this.findDisconnectedNodes(workflow);
    if (disconnectedNodes.length > 0) {
      warnings.push(`Disconnected nodes found: ${disconnectedNodes.join(', ')}`);
    }

    // Validate node configurations
    for (const node of workflow.nodes) {
      const nodeErrors = this.validateNodeConfig(node);
      errors.push(...nodeErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateNodeConfig(node: HybridNode): string[] {
    const errors: string[] = [];

    switch (node.type) {
      case 'agent':
        if (!node.config.agentId) {
          errors.push(`Agent node ${node.id} missing agentId`);
        }
        break;
      case 'tool':
        if (!node.config.toolId) {
          errors.push(`Tool node ${node.id} missing toolId`);
        }
        break;
      case 'hybrid':
        if (!node.config.agentId || !node.config.toolIds) {
          errors.push(`Hybrid node ${node.id} missing agentId or toolIds`);
        }
        break;
    }

    return errors;
  }

  private findEntryNodes(workflow: HybridWorkflow): string[] {
    const hasIncomingEdge = new Set(workflow.edges.map(e => e.target));
    return workflow.nodes
      .filter(node => !hasIncomingEdge.has(node.id))
      .map(node => node.id);
  }

  private getExecutionOrder(workflow: HybridWorkflow): string[] {
    // Topological sort implementation
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new Error('Cycle detected in workflow');
      }
      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);
      
      // Visit dependencies first
      const dependencies = this.getNodeDependencies(workflow, nodeId);
      for (const depId of dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      result.push(nodeId);
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return result;
  }

  private getNodeDependencies(workflow: HybridWorkflow, nodeId: string): string[] {
    return workflow.edges
      .filter(edge => edge.target === nodeId)
      .map(edge => edge.source);
  }

  private getNodeInput(workflow: HybridWorkflow, node: HybridNode, execution: HybridExecution): any {
    const incomingEdges = workflow.edges.filter(e => e.target === node.id);
    
    if (incomingEdges.length === 0) {
      // Entry node - use workflow input
      return execution.input;
    }

    // Collect outputs from source nodes
    const inputs: Record<string, any> = {};
    
    for (const edge of incomingEdges) {
      const sourceExecution = execution.nodeExecutions.get(edge.source);
      if (sourceExecution && sourceExecution.status === 'COMPLETED') {
        inputs[edge.source] = sourceExecution.output;
      }
    }

    return inputs;
  }

  private updateExecutionContext(
    execution: HybridExecution,
    node: HybridNode,
    output: any
  ): void {
    // Update variables based on node output
    if (node.config.outputVariables) {
      for (const [varName, path] of Object.entries(node.config.outputVariables)) {
        const value = this.extractValueByPath(output, path as string);
        execution.context.variables.set(varName, value);
      }
    }

    // Update memory
    execution.context.memory.set(node.id, {
      output,
      timestamp: new Date()
    });
  }

  private aggregateWorkflowOutput(execution: HybridExecution): any {
    const outputs: Record<string, any> = {};
    
    for (const [nodeId, nodeExecution] of execution.nodeExecutions) {
      if (nodeExecution.status === 'COMPLETED') {
        outputs[nodeId] = nodeExecution.output;
      }
    }

    return {
      nodeOutputs: outputs,
      variables: Object.fromEntries(execution.context.variables),
      executionSummary: {
        totalNodes: execution.nodeExecutions.size,
        completedNodes: Array.from(execution.nodeExecutions.values())
          .filter(ne => ne.status === 'COMPLETED').length,
        failedNodes: Array.from(execution.nodeExecutions.values())
          .filter(ne => ne.status === 'FAILED').length,
        totalDuration: execution.duration
      }
    };
  }

  // WebSocket and Event Management
  private initializeWebSocketConnection(): void {
    if (typeof window === 'undefined') return;

    const wsUrl = `${this.baseUrl.replace('http', 'ws')}/api/hybrid/ws`;
    
    try {
      this.wsConnection = new WebSocket(wsUrl);
      
      this.wsConnection.onopen = () => {
        console.log('Hybrid orchestration WebSocket connected');
        
        this.wsConnection?.send(JSON.stringify({
          type: 'auth',
          token: this.getAuthToken()
        }));
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('Hybrid orchestration WebSocket disconnected');
        setTimeout(() => this.initializeWebSocketConnection(), 5000);
      };

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private handleWebSocketMessage(data: any): void {
    const subscribers = this.eventSubscribers.get(data.type);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  private emitExecutionEvent(type: string, payload: any): void {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({ type, payload }));
    }
  }

  private subscribeToEvent(eventType: string, callback: (event: any) => void): () => void {
    if (!this.eventSubscribers.has(eventType)) {
      this.eventSubscribers.set(eventType, new Set());
    }
    
    this.eventSubscribers.get(eventType)!.add(callback);
    
    return () => {
      this.eventSubscribers.get(eventType)?.delete(callback);
    };
  }

  // Queue Processing
  private async processExecutionQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;

    while (this.executionQueue.length > 0) {
      const { execution } = this.executionQueue.shift()!;
      
      try {
        const workflow = await this.getWorkflowDefinition(execution.workflowId);
        if (workflow) {
          await this.executeWorkflowNodes(workflow, execution);
        }
      } catch (error) {
        console.error('Execution processing error:', error);
        execution.status = 'FAILED';
        execution.error = error instanceof Error ? error.message : 'Unknown error';
        execution.completedAt = new Date();
      }
    }

    this.isProcessingQueue = false;
  }

  private startExecutionProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingQueue && this.executionQueue.length > 0) {
        this.processExecutionQueue();
      }
    }, 1000);
  }

  // Utility Methods
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private getPriorityValue(priority: string): number {
    const priorities = { low: 1, normal: 2, high: 3, critical: 4 };
    return priorities[priority as keyof typeof priorities] || 2;
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synapseai_token') || '';
    }
    return process.env.SYNAPSEAI_API_TOKEN || '';
  }

  private hasCycles(workflow: HybridWorkflow): boolean {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visiting.add(nodeId);
      
      const outgoingEdges = workflow.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (visit(edge.target)) return true;
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id) && visit(node.id)) {
        return true;
      }
    }

    return false;
  }

  private findDisconnectedNodes(workflow: HybridWorkflow): string[] {
    const connectedNodes = new Set<string>();
    
    for (const edge of workflow.edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }

    return workflow.nodes
      .filter(node => !connectedNodes.has(node.id))
      .map(node => node.id);
  }

  private parseToolPlan(agentResponse: string): Array<{ toolId: string; input: any }> {
    // This would be a more sophisticated parser in production
    try {
      const parsed = JSON.parse(agentResponse);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private extractValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Public API Methods
  async getExecution(executionId: string): Promise<HybridExecution | null> {
    return this.activeExecutions.get(executionId) || null;
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.status === 'RUNNING') {
      execution.status = 'CANCELLED';
      execution.completedAt = new Date();
      return true;
    }
    return false;
  }

  async pauseExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.status === 'RUNNING') {
      execution.status = 'PAUSED';
      return true;
    }
    return false;
  }

  async resumeExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.status === 'PAUSED') {
      execution.status = 'RUNNING';
      return true;
    }
    return false;
  }

  async provideHumanInput(
    executionId: string,
    nodeId: string,
    response: any,
    userId: string
  ): Promise<void> {
    this.emitExecutionEvent('human_input_response', {
      executionId,
      nodeId,
      response,
      userId,
      providedAt: new Date()
    });
  }

  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.eventSubscribers.clear();
    this.activeExecutions.clear();
  }
}

export const hybridOrchestrationService = new HybridOrchestrationService();