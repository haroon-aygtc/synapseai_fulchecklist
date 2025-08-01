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
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    retryableErrors: string[];
  };
}

export interface HybridNode {
  id: string;
  type: 'agent' | 'tool' | 'hybrid' | 'human' | 'condition' | 'loop';
  agentId?: string;
  toolId?: string;
  config: Record<string, any>;
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
  dependencies: string[];
  conditions?: {
    if: string;
    then: string;
    else?: string;
  };
  loopConfig?: {
    maxIterations: number;
    breakCondition: string;
    iterationVariable: string;
  };
}

export interface HybridExecution {
  id: string;
  nodeId: string;
  type: 'agent-first' | 'tool-first' | 'parallel' | 'multi-tool' | 'conditional' | 'loop';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  input: any;
  output?: any;
  error?: string;
  context: HybridExecutionContext;
  steps: HybridExecutionStep[];
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metrics: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    avgStepDuration: number;
    resourceUsage: Record<string, any>;
  };
}

export interface HybridExecutionStep {
  id: string;
  type: 'agent' | 'tool' | 'coordination' | 'human_input' | 'condition_check' | 'loop_iteration';
  agentId?: string;
  toolId?: string;
  input: any;
  output?: any;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata?: Record<string, any>;
  retryCount?: number;
  resourceMetrics?: {
    memoryUsage: number;
    cpuTime: number;
    tokensUsed: number;
    cost: number;
  };
}

export interface HumanInputRequest {
  id: string;
  executionId: string;
  prompt: string;
  inputType: 'text' | 'choice' | 'file' | 'approval' | 'form';
  options?: any;
  timeout?: number;
  assignedTo?: string;
  status: 'pending' | 'completed' | 'timeout' | 'cancelled';
  response?: any;
  createdAt: Date;
  respondedAt?: Date;
}

export class HybridOrchestrationService {
  private agentService: AgentService;
  private toolService: ToolService;
  private workflowService: WorkflowService;
  private apixClient: ApixClient;
  private baseUrl = '/api/hybrid';
  private activeExecutions = new Map<string, HybridExecution>();
  private humanInputRequests = new Map<string, HumanInputRequest>();
  private executionQueue: Array<{ execution: HybridExecution; priority: number }> = [];
  private isProcessingQueue = false;

  constructor() {
    this.agentService = new AgentService();
    this.toolService = new ToolService();
    this.workflowService = new WorkflowService();
    this.apixClient = new ApixClient();
    this.initializeExecutionEngine();
  }

  // Enhanced Hybrid Execution Patterns
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
      startedAt: new Date(),
      metrics: {
        totalSteps: 0,
        successfulSteps: 0,
        failedSteps: 0,
        avgStepDuration: 0,
        resourceUsage: {}
      }
    };

    this.activeExecutions.set(execution.id, execution);

    try {
      // Step 1: Agent analyzes input and creates execution plan
      const planningStep = await this.executeAgentStep(
        agentId,
        {
          task: 'analyze_and_plan',
          input,
          availableTools: toolIds,
          context: context.metadata
        },
        context,
        'Create an execution plan for the given task using available tools'
      );
      execution.steps.push(planningStep);

      if (planningStep.status === 'failed') {
        execution.status = 'failed';
        execution.error = planningStep.error;
        return this.finalizeExecution(execution);
      }

      // Step 2: Execute tools based on agent's plan
      const plan = planningStep.output?.plan || { steps: [] };
      const toolExecutions = await this.executeToolsFromPlan(
        toolIds,
        plan,
        input,
        context
      );
      execution.steps.push(...toolExecutions);

      // Step 3: Agent synthesizes tool results
      const synthesisStep = await this.executeAgentStep(
        agentId,
        {
          task: 'synthesize_results',
          originalInput: input,
          plan,
          toolResults: toolExecutions.map(step => ({
            toolId: step.toolId,
            output: step.output,
            error: step.error,
            status: step.status
          }))
        },
        context,
        'Synthesize the tool results into a final response'
      );
      execution.steps.push(synthesisStep);

      execution.output = synthesisStep.output;
      execution.status = synthesisStep.status === 'completed' ? 'completed' : 'failed';

      return this.finalizeExecution(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      return this.finalizeExecution(execution);
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
      startedAt: new Date(),
      metrics: {
        totalSteps: 0,
        successfulSteps: 0,
        failedSteps: 0,
        avgStepDuration: 0,
        resourceUsage: {}
      }
    };

    this.activeExecutions.set(execution.id, execution);

    try {
      // Step 1: Execute tools in sequence to gather comprehensive data
      const toolExecutions = await this.executeToolsInSequence(toolIds, input, context);
      execution.steps.push(...toolExecutions);

      // Step 2: Agent processes and interprets all tool results
      const interpretationStep = await this.executeAgentStep(
        agentId,
        {
          task: 'interpret_tool_results',
          originalInput: input,
          toolResults: toolExecutions.map(step => ({
            toolId: step.toolId,
            toolType: step.metadata?.toolType,
            output: step.output,
            error: step.error,
            status: step.status,
            duration: step.duration
          }))
        },
        context,
        'Analyze and interpret the tool results to provide insights and recommendations'
      );
      execution.steps.push(interpretationStep);

      // Step 3: Generate actionable recommendations
      const recommendationStep = await this.executeAgentStep(
        agentId,
        {
          task: 'generate_recommendations',
          interpretation: interpretationStep.output,
          originalInput: input,
          context: context.metadata
        },
        context,
        'Generate actionable recommendations based on the analysis'
      );
      execution.steps.push(recommendationStep);

      execution.output = {
        interpretation: interpretationStep.output,
        recommendations: recommendationStep.output,
        toolResults: toolExecutions.map(step => ({
          toolId: step.toolId,
          output: step.output
        }))
      };

      execution.status = 'completed';
      return this.finalizeExecution(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      return this.finalizeExecution(execution);
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
      startedAt: new Date(),
      metrics: {
        totalSteps: 0,
        successfulSteps: 0,
        failedSteps: 0,
        avgStepDuration: 0,
        resourceUsage: {}
      }
    };

    this.activeExecutions.set(execution.id, execution);

    try {
      // Execute agent and tools in parallel with timeout handling
      const parallelPromises = [
        this.executeAgentStep(
          agentId,
          {
            task: 'parallel_analysis',
            input,
            context: context.metadata
          },
          context,
          'Perform parallel analysis of the input'
        ),
        ...toolIds.map(toolId => 
          this.executeToolStep(toolId, input, context)
        )
      ];

      // Add timeout to parallel execution
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Parallel execution timeout')), 
          context.timeout || 300000); // 5 minutes default
      });

      const results = await Promise.allSettled([
        Promise.race([Promise.all(parallelPromises), timeoutPromise])
      ]);

      const [parallelResult] = results;
      
      if (parallelResult.status === 'rejected') {
        throw new Error(parallelResult.reason);
      }

      const [agentStep, ...toolSteps] = parallelResult.value as HybridExecutionStep[];
      execution.steps.push(agentStep, ...toolSteps);

      // Advanced coordination step with conflict resolution
      const coordinationStep = await this.executeAdvancedCoordinationStep(
        agentStep,
        toolSteps,
        context
      );
      execution.steps.push(coordinationStep);

      execution.output = coordinationStep.output;
      execution.status = coordinationStep.status === 'completed' ? 'completed' : 'failed';

      return this.finalizeExecution(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      return this.finalizeExecution(execution);
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
      startedAt: new Date(),
      metrics: {
        totalSteps: 0,
        successfulSteps: 0,
        failedSteps: 0,
        avgStepDuration: 0,
        resourceUsage: {}
      }
    };

    this.activeExecutions.set(execution.id, execution);

    try {
      let currentInput = input;
      let executionContext = { ...context.metadata };

      // Agent creates dynamic orchestration strategy
      const strategyStep = await this.executeAgentStep(
        agentId,
        {
          task: 'create_orchestration_strategy',
          input,
          availableTools: toolIds,
          context: executionContext
        },
        context,
        'Create a dynamic orchestration strategy for multi-tool execution'
      );
      execution.steps.push(strategyStep);

      const strategy = strategyStep.output?.strategy || { sequence: toolIds };

      // Execute tools according to dynamic strategy
      for (const toolConfig of strategy.sequence) {
        const toolId = typeof toolConfig === 'string' ? toolConfig : toolConfig.toolId;
        const toolParams = typeof toolConfig === 'object' ? toolConfig.params : {};

        // Agent decides tool parameters and execution context
        const parameterStep = await this.executeAgentStep(
          agentId,
          {
            task: 'prepare_tool_execution',
            toolId,
            currentInput,
            executionContext,
            toolParams,
            previousResults: execution.steps
              .filter(s => s.type === 'tool')
              .map(s => ({ toolId: s.toolId, output: s.output }))
          },
          context,
          `Prepare parameters for tool ${toolId} execution`
        );
        execution.steps.push(parameterStep);

        if (parameterStep.status === 'failed') {
          this.logExecutionWarning(execution.id, `Parameter preparation failed for tool ${toolId}`);
          continue;
        }

        // Execute tool with agent-prepared parameters
        const toolStep = await this.executeToolStep(
          toolId,
          parameterStep.output?.toolInput || currentInput,
          context
        );
        execution.steps.push(toolStep);

        // Agent evaluates tool result and decides next action
        const evaluationStep = await this.executeAgentStep(
          agentId,
          {
            task: 'evaluate_tool_result',
            toolId,
            toolResult: toolStep.output,
            toolError: toolStep.error,
            currentContext: executionContext,
            remainingTools: strategy.sequence.slice(strategy.sequence.indexOf(toolConfig) + 1)
          },
          context,
          `Evaluate result from tool ${toolId} and plan next steps`
        );
        execution.steps.push(evaluationStep);

        // Update execution context based on evaluation
        if (evaluationStep.output?.shouldContinue === false) {
          break;
        }

        if (evaluationStep.output?.updatedContext) {
          executionContext = { ...executionContext, ...evaluationStep.output.updatedContext };
        }

        if (evaluationStep.output?.nextInput) {
          currentInput = evaluationStep.output.nextInput;
        } else if (toolStep.status === 'completed') {
          currentInput = toolStep.output;
        }
      }

      // Final synthesis step
      const synthesisStep = await this.executeAgentStep(
        agentId,
        {
          task: 'synthesize_multi_tool_results',
          originalInput: input,
          strategy,
          allResults: execution.steps
            .filter(s => s.type === 'tool')
            .map(s => ({
              toolId: s.toolId,
              output: s.output,
              error: s.error,
              status: s.status
            })),
          finalContext: executionContext
        },
        context,
        'Synthesize all multi-tool results into a comprehensive final output'
      );
      execution.steps.push(synthesisStep);

      execution.output = synthesisStep.output;
      execution.status = synthesisStep.status === 'completed' ? 'completed' : 'failed';

      return this.finalizeExecution(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      return this.finalizeExecution(execution);
    }
  }

  // Conditional Execution Pattern
  async executeConditional(
    nodeId: string,
    conditionConfig: {
      condition: string;
      thenBranch: { type: string; config: any };
      elseBranch?: { type: string; config: any };
    },
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecution> {
    const execution: HybridExecution = {
      id: this.generateId(),
      nodeId,
      type: 'conditional',
      status: 'running',
      input,
      context,
      steps: [],
      startedAt: new Date(),
      metrics: {
        totalSteps: 0,
        successfulSteps: 0,
        failedSteps: 0,
        avgStepDuration: 0,
        resourceUsage: {}
      }
    };

    this.activeExecutions.set(execution.id, execution);

    try {
      // Evaluate condition
      const conditionStep = await this.evaluateCondition(
        conditionConfig.condition,
        input,
        context
      );
      execution.steps.push(conditionStep);

      const conditionResult = conditionStep.output?.result || false;
      const branchToExecute = conditionResult ? conditionConfig.thenBranch : conditionConfig.elseBranch;

      if (!branchToExecute) {
        execution.output = { conditionResult, message: 'No branch to execute' };
        execution.status = 'completed';
        return this.finalizeExecution(execution);
      }

      // Execute selected branch
      const branchExecution = await this.executeBranch(branchToExecute, input, context);
      execution.steps.push(...branchExecution.steps);

      execution.output = {
        conditionResult,
        branchExecuted: conditionResult ? 'then' : 'else',
        branchOutput: branchExecution.output
      };
      execution.status = branchExecution.status;

      return this.finalizeExecution(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      return this.finalizeExecution(execution);
    }
  }

  // Loop Execution Pattern
  async executeLoop(
    nodeId: string,
    loopConfig: {
      maxIterations: number;
      breakCondition: string;
      iterationLogic: { type: string; config: any };
    },
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecution> {
    const execution: HybridExecution = {
      id: this.generateId(),
      nodeId,
      type: 'loop',
      status: 'running',
      input,
      context,
      steps: [],
      startedAt: new Date(),
      metrics: {
        totalSteps: 0,
        successfulSteps: 0,
        failedSteps: 0,
        avgStepDuration: 0,
        resourceUsage: {}
      }
    };

    this.activeExecutions.set(execution.id, execution);

    try {
      let currentInput = input;
      let iteration = 0;
      const iterationResults: any[] = [];

      while (iteration < loopConfig.maxIterations) {
        iteration++;

        // Execute iteration logic
        const iterationExecution = await this.executeBranch(
          loopConfig.iterationLogic,
          currentInput,
          { ...context, metadata: { ...context.metadata, iteration } }
        );

        const iterationStep: HybridExecutionStep = {
          id: this.generateId(),
          type: 'loop_iteration',
          input: currentInput,
          output: iterationExecution.output,
          error: iterationExecution.error,
          status: iterationExecution.status,
          startedAt: new Date(),
          completedAt: new Date(),
          duration: iterationExecution.duration,
          metadata: { iteration, iterationSteps: iterationExecution.steps.length }
        };

        execution.steps.push(iterationStep);
        execution.steps.push(...iterationExecution.steps);

        if (iterationExecution.status === 'failed') {
          execution.status = 'failed';
          execution.error = `Loop failed at iteration ${iteration}: ${iterationExecution.error}`;
          break;
        }

        iterationResults.push(iterationExecution.output);

        // Check break condition
        const breakConditionStep = await this.evaluateCondition(
          loopConfig.breakCondition,
          {
            currentResult: iterationExecution.output,
            allResults: iterationResults,
            iteration,
            originalInput: input
          },
          context
        );

        execution.steps.push(breakConditionStep);

        if (breakConditionStep.output?.result === true) {
          break;
        }

        // Prepare input for next iteration
        currentInput = iterationExecution.output || currentInput;
      }

      execution.output = {
        iterations: iteration,
        results: iterationResults,
        finalResult: iterationResults[iterationResults.length - 1]
      };
      execution.status = execution.status === 'failed' ? 'failed' : 'completed';

      return this.finalizeExecution(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      return this.finalizeExecution(execution);
    }
  }

  // Human-in-the-Loop Integration
  async pauseForHumanInput(
    executionId: string,
    prompt: string,
    inputType: 'text' | 'choice' | 'file' | 'approval' | 'form',
    options?: any
  ): Promise<string> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    const requestId = this.generateId();
    const humanInputRequest: HumanInputRequest = {
      id: requestId,
      executionId,
      prompt,
      inputType,
      options,
      timeout: options?.timeout || 3600000, // 1 hour default
      assignedTo: options?.assignedTo,
      status: 'pending',
      createdAt: new Date()
    };

    this.humanInputRequests.set(requestId, humanInputRequest);

    // Pause execution
    execution.status = 'paused';

    // Create human input step
    const humanInputStep: HybridExecutionStep = {
      id: this.generateId(),
      type: 'human_input',
      input: { prompt, inputType, options },
      status: 'pending',
      startedAt: new Date(),
      metadata: { requestId, timeout: humanInputRequest.timeout }
    };

    execution.steps.push(humanInputStep);

    await this.apixClient.broadcast('hybrid-events', {
      type: 'human-input-required',
      executionId,
      requestId,
      prompt,
      inputType,
      options,
      assignedTo: options?.assignedTo
    });

    // Set timeout for human input
    setTimeout(() => {
      const request = this.humanInputRequests.get(requestId);
      if (request && request.status === 'pending') {
        request.status = 'timeout';
        humanInputStep.status = 'failed';
        humanInputStep.error = 'Human input timeout';
        humanInputStep.completedAt = new Date();
        humanInputStep.duration = Date.now() - humanInputStep.startedAt.getTime();

        execution.status = 'failed';
        execution.error = 'Human input timeout';

        this.apixClient.broadcast('hybrid-events', {
          type: 'human-input-timeout',
          executionId,
          requestId
        });
      }
    }, humanInputRequest.timeout);

    return requestId;
  }

  async resumeWithHumanInput(executionId: string, requestId: string, input: any): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    const request = this.humanInputRequests.get(requestId);

    if (!execution || !request) {
      throw new Error('Execution or human input request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Human input request is not pending');
    }

    // Update request
    request.status = 'completed';
    request.response = input;
    request.respondedAt = new Date();

    // Update execution step
    const humanInputStep = execution.steps.find(
      step => step.metadata?.requestId === requestId
    );

    if (humanInputStep) {
      humanInputStep.status = 'completed';
      humanInputStep.output = input;
      humanInputStep.completedAt = new Date();
      humanInputStep.duration = Date.now() - humanInputStep.startedAt.getTime();
    }

    // Resume execution
    execution.status = 'running';

    await this.apixClient.broadcast('hybrid-events', {
      type: 'human-input-received',
      executionId,
      requestId,
      input
    });

    // Continue execution from where it was paused
    await this.continueExecution(execution, input);
  }

  // Advanced Helper Methods
  private async executeToolsFromPlan(
    toolIds: string[],
    plan: any,
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep[]> {
    const steps: HybridExecutionStep[] = [];
    const planSteps = plan.steps || [];

    for (const planStep of planSteps) {
      const toolId = planStep.toolId;
      if (!toolIds.includes(toolId)) continue;

      const toolStep = await this.executeToolStep(
        toolId,
        planStep.input || input,
        context
      );
      
      toolStep.metadata = {
        ...toolStep.metadata,
        planStep: planStep.description,
        expectedOutput: planStep.expectedOutput
      };

      steps.push(toolStep);

      // Stop execution if critical tool fails
      if (toolStep.status === 'failed' && planStep.critical) {
        break;
      }
    }

    return steps;
  }

  private async executeAdvancedCoordinationStep(
    agentStep: HybridExecutionStep,
    toolSteps: HybridExecutionStep[],
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep> {
    const step: HybridExecutionStep = {
      id: this.generateId(),
      type: 'coordination',
      input: {
        agentResult: agentStep.output,
        toolResults: toolSteps.map(s => ({ 
          toolId: s.toolId, 
          output: s.output, 
          error: s.error,
          status: s.status,
          confidence: s.metadata?.confidence
        }))
      },
      status: 'running',
      startedAt: new Date()
    };

    try {
      // Advanced coordination with conflict resolution
      const conflicts = this.detectConflicts(agentStep, toolSteps);
      
      if (conflicts.length > 0) {
        const resolution = await this.resolveConflicts(conflicts, context);
        step.output = {
          agentResult: agentStep.output,
          toolResults: toolSteps.reduce((acc, s) => {
            if (s.toolId) acc[s.toolId] = s.output;
            return acc;
          }, {} as Record<string, any>),
          conflicts,
          resolution,
          finalResult: resolution.resolvedOutput
        };
      } else {
        // No conflicts - simple merge
        step.output = {
          agentResult: agentStep.output,
          toolResults: toolSteps.reduce((acc, s) => {
            if (s.toolId) acc[s.toolId] = s.output;
            return acc;
          }, {} as Record<string, any>),
          finalResult: this.mergeResults(agentStep, toolSteps)
        };
      }

      step.status = 'completed';

    } catch (error) {
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.status = 'failed';
    }

    step.completedAt = new Date();
    step.duration = step.completedAt.getTime() - step.startedAt.getTime();

    return step;
  }

  private detectConflicts(
    agentStep: HybridExecutionStep,
    toolSteps: HybridExecutionStep[]
  ): Array<{ type: string; description: string; sources: string[] }> {
    const conflicts: Array<{ type: string; description: string; sources: string[] }> = [];

    // Check for contradictory outputs
    const agentOutput = agentStep.output;
    const toolOutputs = toolSteps.map(s => s.output);

    // Simple conflict detection - can be enhanced with ML models
    if (agentOutput && typeof agentOutput === 'object') {
      for (const toolOutput of toolOutputs) {
        if (toolOutput && typeof toolOutput === 'object') {
          for (const [key, agentValue] of Object.entries(agentOutput)) {
            if (key in toolOutput && toolOutput[key] !== agentValue) {
              conflicts.push({
                type: 'value_conflict',
                description: `Conflicting values for ${key}: agent says ${agentValue}, tool says ${toolOutput[key]}`,
                sources: ['agent', 'tool']
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  private async resolveConflicts(
    conflicts: Array<{ type: string; description: string; sources: string[] }>,
    context: HybridExecutionContext
  ): Promise<{ strategy: string; resolvedOutput: any }> {
    // Simple conflict resolution - can be enhanced with sophisticated algorithms
    const strategy = 'agent_priority'; // Default strategy

    switch (strategy) {
      case 'agent_priority':
        return {
          strategy: 'agent_priority',
          resolvedOutput: 'Agent output takes priority in conflicts'
        };
      case 'tool_consensus':
        return {
          strategy: 'tool_consensus',
          resolvedOutput: 'Tool consensus used to resolve conflicts'
        };
      case 'human_intervention':
        // Would trigger human input request
        return {
          strategy: 'human_intervention',
          resolvedOutput: 'Human intervention required for conflict resolution'
        };
      default:
        return {
          strategy: 'default',
          resolvedOutput: 'Default conflict resolution applied'
        };
    }
  }

  private mergeResults(
    agentStep: HybridExecutionStep,
    toolSteps: HybridExecutionStep[]
  ): any {
    const merged = {
      agentInsights: agentStep.output,
      toolData: {}
    };

    for (const toolStep of toolSteps) {
      if (toolStep.toolId && toolStep.output) {
        (merged.toolData as any)[toolStep.toolId] = toolStep.output;
      }
    }

    return merged;
  }

  private async evaluateCondition(
    condition: string,
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecutionStep> {
    const step: HybridExecutionStep = {
      id: this.generateId(),
      type: 'condition_check',
      input: { condition, data: input },
      status: 'running',
      startedAt: new Date()
    };

    try {
      // Simple condition evaluation - can be enhanced with expression parser
      const result = this.evaluateSimpleCondition(condition, input);
      
      step.output = { result, condition, evaluatedData: input };
      step.status = 'completed';

    } catch (error) {
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.status = 'failed';
    }

    step.completedAt = new Date();
    step.duration = step.completedAt.getTime() - step.startedAt.getTime();

    return step;
  }

  private evaluateSimpleCondition(condition: string, data: any): boolean {
    // Simple condition evaluation - replace with proper expression parser
    try {
      // Basic safety check
      if (condition.includes('eval') || condition.includes('Function')) {
        throw new Error('Unsafe condition expression');
      }

      // Replace data references
      const safeCondition = condition.replace(/data\.(\w+)/g, (match, prop) => {
        return JSON.stringify(data[prop]);
      });

      // Evaluate simple conditions
      return Function(`"use strict"; return (${safeCondition})`)();
    } catch (error) {
      console.warn('Condition evaluation failed:', error);
      return false;
    }
  }

  private async executeBranch(
    branch: { type: string; config: any },
    input: any,
    context: HybridExecutionContext
  ): Promise<HybridExecution> {
    switch (branch.type) {
      case 'agent-first':
        return this.executeAgentFirst(
          this.generateId(),
          branch.config.agentId,
          branch.config.toolIds || [],
          input,
          context
        );
      case 'tool-first':
        return this.executeToolFirst(
          this.generateId(),
          branch.config.toolIds || [],
          branch.config.agentId,
          input,
          context
        );
      case 'parallel':
        return this.executeParallel(
          this.generateId(),
          branch.config.agentId,
          branch.config.toolIds || [],
          input,
          context
        );
      default:
        throw new Error(`Unknown branch type: ${branch.type}`);
    }
  }

  private async continueExecution(execution: HybridExecution, humanInput: any): Promise<void> {
    // Find the last incomplete step and continue from there
    const lastStep = execution.steps[execution.steps.length - 1];
    
    if (lastStep && lastStep.type === 'human_input') {
      // Continue with the human input as the next step's input
      // This is a simplified implementation - real implementation would be more complex
      execution.status = 'completed';
      execution.output = { humanInput, message: 'Execution completed with human input' };
      
      await this.finalizeExecution(execution);
    }
  }

  private finalizeExecution(execution: HybridExecution): HybridExecution {
    execution.completedAt = new Date();
    execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

    // Calculate metrics
    execution.metrics.totalSteps = execution.steps.length;
    execution.metrics.successfulSteps = execution.steps.filter(s => s.status === 'completed').length;
    execution.metrics.failedSteps = execution.steps.filter(s => s.status === 'failed').length;
    execution.metrics.avgStepDuration = execution.steps.length > 0 
      ? execution.steps.reduce((sum, s) => sum + (s.duration || 0), 0) / execution.steps.length
      : 0;

    // Calculate resource usage
    execution.metrics.resourceUsage = {
      totalTokens: execution.steps.reduce((sum, s) => sum + (s.resourceMetrics?.tokensUsed || 0), 0),
      totalCost: execution.steps.reduce((sum, s) => sum + (s.resourceMetrics?.cost || 0), 0),
      memoryPeak: Math.max(...execution.steps.map(s => s.resourceMetrics?.memoryUsage || 0)),
      cpuTime: execution.steps.reduce((sum, s) => sum + (s.resourceMetrics?.cpuTime || 0), 0)
    };

    this.activeExecutions.delete(execution.id);

    this.apixClient.broadcast('hybrid-events', {
      type: 'execution-completed',
      execution
    });

    return execution;
  }

  // Execution Engine Management
  private initializeExecutionEngine(): void {
    // Start queue processor
    this.processExecutionQueue();
    
    // Set up cleanup intervals
    setInterval(() => {
      this.cleanupCompletedExecutions();
    }, 300000); // 5 minutes

    setInterval(() => {
      this.cleanupExpiredHumanInputs();
    }, 60000); // 1 minute
  }

  private async processExecutionQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;

    while (this.executionQueue.length > 0) {
      // Sort by priority
      this.executionQueue.sort((a, b) => b.priority - a.priority);
      
      const { execution } = this.executionQueue.shift()!;
      
      try {
        // Process execution based on type
        // This is where the actual execution logic would be called
        await this.processQueuedExecution(execution);
      } catch (error) {
        console.error('Queue execution failed:', error);
      }
    }

    this.isProcessingQueue = false;
    
    // Schedule next queue processing
    setTimeout(() => {
      this.processExecutionQueue();
    }, 1000);
  }

  private async processQueuedExecution(execution: HybridExecution): Promise<void> {
    // This would contain the logic to process queued executions
    // For now, it's a placeholder
    console.log(`Processing queued execution: ${execution.id}`);
  }

  private cleanupCompletedExecutions(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [id, execution] of this.activeExecutions.entries()) {
      if (execution.completedAt && execution.completedAt.getTime() < cutoffTime) {
        this.activeExecutions.delete(id);
      }
    }
  }

  private cleanupExpiredHumanInputs(): void {
    const now = Date.now();
    
    for (const [id, request] of this.humanInputRequests.entries()) {
      const expiryTime = request.createdAt.getTime() + (request.timeout || 3600000);
      
      if (now > expiryTime && request.status === 'pending') {
        request.status = 'timeout';
        this.humanInputRequests.delete(id);
      }
    }
  }

  private logExecutionWarning(executionId: string, message: string): void {
    console.warn(`[Execution ${executionId}] ${message}`);
  }

  // Enhanced Step Execution Methods
  private async executeAgentStep(
    agentId: string,
    input: any,
    context: HybridExecutionContext,
    instruction?: string
  ): Promise<HybridExecutionStep> {
    const step: HybridExecutionStep = {
      id: this.generateId(),
      type: 'agent',
      agentId,
      input,
      status: 'running',
      startedAt: new Date(),
      retryCount: 0
    };

    const maxRetries = context.retryPolicy?.maxRetries || 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        // Enhanced agent execution with instruction
        const enhancedInput = instruction ? {
          ...input,
          systemInstruction: instruction
        } : input;

        const result = await this.agentService.testAgent(agentId, enhancedInput);
        
        const endTime = Date.now();
        const duration = endTime - startTime;

        step.output = result;
        step.status = 'completed';
        step.duration = duration;
        step.resourceMetrics = {
          memoryUsage: 0, // Would be measured in real implementation
          cpuTime: duration,
          tokensUsed: this.estimateTokenUsage(input, result),
          cost: this.estimateCost(agentId, input, result)
        };

        break;

      } catch (error) {
        step.retryCount = attempt;
        
        if (attempt === maxRetries) {
          step.error = error instanceof Error ? error.message : 'Unknown error';
          step.status = 'failed';
        } else {
          // Apply backoff strategy
          const delay = this.calculateBackoffDelay(attempt, context.retryPolicy?.backoffStrategy);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    step.completedAt = new Date();
    if (!step.duration) {
      step.duration = step.completedAt.getTime() - step.startedAt.getTime();
    }

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
      startedAt: new Date(),
      retryCount: 0
    };

    const maxRetries = context.retryPolicy?.maxRetries || 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        const execution = await this.toolService.executeTool(toolId, input, context);
        
        const endTime = Date.now();
        const duration = endTime - startTime;

        step.output = execution.output;
        step.error = execution.error;
        step.status = execution.status === 'COMPLETED' ? 'completed' : 'failed';
        step.duration = duration;
        step.resourceMetrics = {
          memoryUsage: 0, // Would be measured in real implementation
          cpuTime: duration,
          tokensUsed: 0, // Tools typically don't use tokens
          cost: this.estimateToolCost(toolId, input, execution.output)
        };

        if (step.status === 'completed') break;

      } catch (error) {
        step.retryCount = attempt;
        
        if (attempt === maxRetries) {
          step.error = error instanceof Error ? error.message : 'Unknown error';
          step.status = 'failed';
        } else {
          const delay = this.calculateBackoffDelay(attempt, context.retryPolicy?.backoffStrategy);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    step.completedAt = new Date();
    if (!step.duration) {
      step.duration = step.completedAt.getTime() - step.startedAt.getTime();
    }

    return step;
  }

  private calculateBackoffDelay(attempt: number, strategy?: string): number {
    const baseDelay = 1000; // 1 second
    
    switch (strategy) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt);
      case 'linear':
      default:
        return baseDelay * (attempt + 1);
    }
  }

  private estimateTokenUsage(input: any, output: any): number {
    // Simple token estimation - replace with proper tokenization
    const inputStr = JSON.stringify(input);
    const outputStr = JSON.stringify(output);
    return Math.ceil((inputStr.length + outputStr.length) / 4);
  }

  private estimateCost(agentId: string, input: any, output: any): number {
    // Simple cost estimation - replace with actual pricing
    const tokens = this.estimateTokenUsage(input, output);
    return tokens * 0.00002; // $0.00002 per token (example rate)
  }

  private estimateToolCost(toolId: string, input: any, output: any): number {
    // Tool-specific cost estimation
    return 0.001; // $0.001 per tool execution (example rate)
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}