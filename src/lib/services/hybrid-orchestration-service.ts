import { AgentService } from '../agents/agent-service';
import { ToolService } from './tool-service';
import { WorkflowService } from './workflow-service';
import { ApixClient } from '../apix/client';
import { z } from 'zod';

export interface HybridExecutionContext {
  sessionId: string;
  userId?: string;
  organizationId: string;
  workflowExecutionId?: string;
  metadata?: Record<string, any>;
}

export interface HybridNode {
  id: string;
  type: 'agent' | 'tool' | 'hybrid';
  agentId?: string;
  toolId?: string;
  config: Record<string, any>;
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
}

export interface HybridExecution {
  id: string;
  nodeId: string;
  type: 'agent-first' | 'tool-first' | 'parallel' | 'multi-tool';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  input: any;
  output?: any;
  error?: string;
  context: HybridExecutionContext;
  steps: HybridExecutionStep[];
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export interface HybridExecutionStep {
  id: string;
  type: 'agent' | 'tool' | 'coordination';
  agentId?: string;
  toolId?: string;
  input: any;
  output?: any;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export class HybridOrchestrationService {
  private agentService: AgentService;
  private toolService: ToolService;
  private workflowService: WorkflowService;
  private apixClient: ApixClient;
  private baseUrl = '/api/hybrid';

  constructor() {
    this.agentService = new AgentService();
    this.toolService = new ToolService();
    this.workflowService = new WorkflowService();
    this.apixClient = new ApixClient();
  }

  // Hybrid Execution Patterns
  async executeAgentFirst(
    nodeId: string,
    agentId: string,
    toolIds: string[],
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecution> {
    const execution: HybridExecution = {
      id: this.generateId(),
      nodeId,
      type: 'agent-first',
      status: 'running',
      input,
      context,
      steps: [],
      startedAt: new Date()
    };

    try {
      // Step 1: Agent processes input and determines tool usage
      const agentStep = await this.executeAgentStep(agentId, input, context);
      execution.steps.push(agentStep);

      if (agentStep.status === 'failed') {
        execution.status = 'failed';
        execution.error = agentStep.error;
        return execution;
      }

      // Step 2: Execute tools based on agent's decision
      const toolExecutions = await this.executeToolsFromAgentDecision(
        toolIds,
        agentStep.output,
        context
      );
      execution.steps.push(...toolExecutions);

      // Step 3: Agent processes tool results
      const finalAgentStep = await this.executeAgentStep(
        agentId,
        {
          originalInput: input,
          toolResults: toolExecutions.map(step => ({
            toolId: step.toolId,
            output: step.output,
            error: step.error
          }))
        },
        context
      );
      execution.steps.push(finalAgentStep);

      execution.output = finalAgentStep.output;
      execution.status = finalAgentStep.status === 'completed' ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Broadcast execution update via APIX
      await this.apixClient.broadcast('hybrid-events', {
        type: 'execution-completed',
        execution
      });

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      return execution;
    }
  }

  async executeToolFirst(
    nodeId: string,
    toolIds: string[],
    agentId: string,
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecution> {
    const execution: HybridExecution = {
      id: this.generateId(),
      nodeId,
      type: 'tool-first',
      status: 'running',
      input,
      context,
      steps: [],
      startedAt: new Date()
    };

    try {
      // Step 1: Execute tools to gather data
      const toolExecutions = await this.executeToolsInSequence(toolIds, input, context);
      execution.steps.push(...toolExecutions);

      // Step 2: Agent processes tool results
      const agentStep = await this.executeAgentStep(
        agentId,
        {
          originalInput: input,
          toolResults: toolExecutions.map(step => ({
            toolId: step.toolId,
            output: step.output,
            error: step.error
          }))
        },
        context
      );
      execution.steps.push(agentStep);

      execution.output = agentStep.output;
      execution.status = agentStep.status === 'completed' ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      await this.apixClient.broadcast('hybrid-events', {
        type: 'execution-completed',
        execution
      });

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      return execution;
    }
  }

  async executeParallel(
    nodeId: string,
    agentId: string,
    toolIds: string[],
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecution> {
    const execution: HybridExecution = {
      id: this.generateId(),
      nodeId,
      type: 'parallel',
      status: 'running',
      input,
      context,
      steps: [],
      startedAt: new Date()
    };

    try {
      // Execute agent and tools in parallel
      const [agentStep, ...toolSteps] = await Promise.all([
        this.executeAgentStep(agentId, input, context),
        ...toolIds.map(toolId => this.executeToolStep(toolId, input, context))
      ]);

      execution.steps.push(agentStep, ...toolSteps);

      // Coordination step to merge results
      const coordinationStep = await this.executeCoordinationStep(
        agentStep,
        toolSteps,
        context
      );
      execution.steps.push(coordinationStep);

      execution.output = coordinationStep.output;
      execution.status = coordinationStep.status === 'completed' ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      await this.apixClient.broadcast('hybrid-events', {
        type: 'execution-completed',
        execution
      });

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      return execution;
    }
  }

  async executeMultiTool(
    nodeId: string,
    agentId: string,
    toolIds: string[],
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecution> {
    const execution: HybridExecution = {
      id: this.generateId(),
      nodeId,
      type: 'multi-tool',
      status: 'running',
      input,
      context,
      steps: [],
      startedAt: new Date()
    };

    try {
      // Agent orchestrates multiple tools
      let currentInput = input;
      let agentStep: HybridExecutionStep;

      for (const toolId of toolIds) {
        // Agent decides how to use the next tool
        agentStep = await this.executeAgentStep(
          agentId,
          {
            originalInput: input,
            currentInput,
            nextToolId: toolId,
            previousResults: execution.steps.filter(s => s.type === 'tool').map(s => ({
              toolId: s.toolId,
              output: s.output
            }))
          },
          context
        );
        execution.steps.push(agentStep);

        if (agentStep.status === 'failed') break;

        // Execute the tool with agent's instructions
        const toolStep = await this.executeToolStep(
          toolId,
          agentStep.output.toolInput || currentInput,
          context
        );
        execution.steps.push(toolStep);

        if (toolStep.status === 'failed') break;

        currentInput = toolStep.output;
      }

      // Final agent step to process all results
      const finalAgentStep = await this.executeAgentStep(
        agentId,
        {
          originalInput: input,
          allResults: execution.steps.filter(s => s.type === 'tool').map(s => ({
            toolId: s.toolId,
            output: s.output
          }))
        },
        context
      );
      execution.steps.push(finalAgentStep);

      execution.output = finalAgentStep.output;
      execution.status = finalAgentStep.status === 'completed' ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      await this.apixClient.broadcast('hybrid-events', {
        type: 'execution-completed',
        execution
      });

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      return execution;
    }
  }

  // Human-in-the-Loop Integration
  async pauseForHumanInput(
    executionId: string,
    prompt: string,
    inputType: 'text' | 'choice' | 'file' | 'approval',
    options?: any
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, inputType, options })
    });

    if (!response.ok) {
      throw new Error(`Failed to pause for human input: ${response.statusText}`);
    }

    await this.apixClient.broadcast('hybrid-events', {
      type: 'human-input-required',
      executionId,
      prompt,
      inputType,
      options
    });
  }

  async resumeWithHumanInput(executionId: string, input: any): Promise<void> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });

    if (!response.ok) {
      throw new Error(`Failed to resume with human input: ${response.statusText}`);
    }

    await this.apixClient.broadcast('hybrid-events', {
      type: 'human-input-received',
      executionId,
      input
    });
  }

  // Session Context Management
  async createUnifiedSession(
    agentIds: string[],
    toolIds: string[],
    userId?: string
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentIds, toolIds, userId })
    });

    if (!response.ok) {
      throw new Error(`Failed to create unified session: ${response.statusText}`);
    }

    const { sessionId } = await response.json();
    return sessionId;
  }

  async updateSessionContext(sessionId: string, context: Record<string, any>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });

    if (!response.ok) {
      throw new Error(`Failed to update session context: ${response.statusText}`);
    }

    await this.apixClient.broadcast('hybrid-events', {
      type: 'session-context-updated',
      sessionId,
      context
    });
  }

  async getSessionContext(sessionId: string): Promise<Record<string, any>> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/context`);

    if (!response.ok) {
      throw new Error(`Failed to get session context: ${response.statusText}`);
    }

    return response.json();
  }

  // Execution Monitoring & Analytics
  async getExecution(executionId: string): Promise<HybridExecution> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}`);

    if (!response.ok) {
      throw new Error(`Failed to get execution: ${response.statusText}`);
    }

    return response.json();
  }

  async getExecutionHistory(
    nodeId?: string,
    limit: number = 50
  ): Promise<HybridExecution[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (nodeId) params.append('nodeId', nodeId);

    const response = await fetch(`${this.baseUrl}/executions?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to get execution history: ${response.statusText}`);
    }

    return response.json();
  }

  async getAnalytics(period: string = '7d'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/analytics?period=${period}`);

    if (!response.ok) {
      throw new Error(`Failed to get analytics: ${response.statusText}`);
    }

    return response.json();
  }

  // Private Helper Methods
  private async executeAgentStep(
    agentId: string,
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep> {
    const step: HybridExecutionStep = {
      id: this.generateId(),
      type: 'agent',
      agentId,
      input,
      status: 'running',
      startedAt: new Date()
    };

    try {
      const result = await this.agentService.testAgent(agentId, input);
      step.output = result;
      step.status = 'completed';
    } catch (error) {
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.status = 'failed';
    }

    step.completedAt = new Date();
    step.duration = step.completedAt.getTime() - step.startedAt.getTime();

    return step;
  }

  private async executeToolStep(
    toolId: string,
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep> {
    const step: HybridExecutionStep = {
      id: this.generateId(),
      type: 'tool',
      toolId,
      input,
      status: 'running',
      startedAt: new Date()
    };

    try {
      const execution = await this.toolService.executeTool(toolId, input, context);
      step.output = execution.output;
      step.status = execution.status === 'COMPLETED' ? 'completed' : 'failed';
      if (execution.error) step.error = execution.error;
    } catch (error) {
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.status = 'failed';
    }

    step.completedAt = new Date();
    step.duration = step.completedAt.getTime() - step.startedAt.getTime();

    return step;
  }

  private async executeToolsFromAgentDecision(
    toolIds: string[],
    agentOutput: any,
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep[]> {
    const steps: HybridExecutionStep[] = [];
    const toolInstructions = agentOutput.toolInstructions || {};

    for (const toolId of toolIds) {
      if (toolInstructions[toolId]) {
        const step = await this.executeToolStep(
          toolId,
          toolInstructions[toolId],
          context
        );
        steps.push(step);
      }
    }

    return steps;
  }

  private async executeToolsInSequence(
    toolIds: string[],
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep[]> {
    const steps: HybridExecutionStep[] = [];
    let currentInput = input;

    for (const toolId of toolIds) {
      const step = await this.executeToolStep(toolId, currentInput, context);
      steps.push(step);
      
      if (step.status === 'completed' && step.output) {
        currentInput = step.output;
      }
    }

    return steps;
  }

  private async executeCoordinationStep(
    agentStep: HybridExecutionStep,
    toolSteps: HybridExecutionStep[],
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep> {
    const step: HybridExecutionStep = {
      id: this.generateId(),
      type: 'coordination',
      input: {
        agentResult: agentStep.output,
        toolResults: toolSteps.map(s => ({ toolId: s.toolId, output: s.output }))
      },
      status: 'running',
      startedAt: new Date()
    };

    try {
      // Simple coordination logic - can be enhanced with ML models
      const hasErrors = [agentStep, ...toolSteps].some(s => s.status === 'failed');
      
      if (hasErrors) {
        step.status = 'failed';
        step.error = 'One or more parallel executions failed';
      } else {
        step.output = {
          agentResult: agentStep.output,
          toolResults: toolSteps.reduce((acc, s) => {
            if (s.toolId) acc[s.toolId] = s.output;
            return acc;
          }, {} as Record<string, any>)
        };
        step.status = 'completed';
      }
    } catch (error) {
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.status = 'failed';
    }

    step.completedAt = new Date();
    step.duration = step.completedAt.getTime() - step.startedAt.getTime();

    return step;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}