import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { ProvidersService } from '../providers/providers.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { Workflow, WorkflowExecution, WorkflowSchedule, NodeType, ExecutionStatus } from '@prisma/client';
import { z } from 'zod';
import * as cron from 'node-cron';

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.nativeEnum(NodeType),
    label: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    data: z.record(z.any()).default({}),
    config: z.record(z.any()).default({})
  })).default([]),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.string().optional(),
    label: z.string().optional(),
    data: z.record(z.any()).default({})
  })).default([]),
  triggers: z.array(z.record(z.any())).default([]),
  variables: z.record(z.any()).default({}),
  settings: z.object({
    executionTimeout: z.number().default(300000),
    maxConcurrentExecutions: z.number().default(1),
    retryOnFailure: z.boolean().default(false),
    maxRetries: z.number().default(3),
    logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
    notifyOnCompletion: z.boolean().default(false),
    notifyOnFailure: z.boolean().default(true),
    notificationChannels: z.array(z.string()).default([])
  }).default({}),
  tags: z.array(z.string()).default([]),
  isTemplate: z.boolean().default(false)
});

const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

const ExecuteWorkflowSchema = z.object({
  input: z.record(z.any()).default({}),
  variables: z.record(z.any()).default({}),
  options: z.object({
    timeout: z.number().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
    retryOnFailure: z.boolean().optional(),
    maxRetries: z.number().optional()
  }).default({})
});

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  cronExpression: z.string(),
  timezone: z.string().default('UTC'),
  input: z.record(z.any()).default({}),
  variables: z.record(z.any()).default({}),
  isActive: z.boolean().default(true)
});

interface NodeExecutionContext {
  nodeId: string;
  nodeType: NodeType;
  config: any;
  input: any;
  variables: any;
  sessionContext: any;
  executionId: string;
  workflowId: string;
  organizationId: string;
  userId: string;
}

interface WorkflowExecutionEngine {
  executeNode(context: NodeExecutionContext): Promise<any>;
  validateWorkflow(workflow: Workflow): Promise<string[]>;
  optimizeExecution(workflow: Workflow): Promise<any>;
}

@Injectable()
export class WorkflowsService implements WorkflowExecutionEngine {
  private readonly logger = new Logger(WorkflowsService.name);
  private scheduledJobs = new Map<string, any>();
  private activeExecutions = new Map<string, any>();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService,
    private providers: ProvidersService,
    private knowledge: KnowledgeService
  ) {
    this.initializeScheduler();
  }

  async createWorkflow(
    userId: string,
    organizationId: string,
    data: z.infer<typeof CreateWorkflowSchema>
  ): Promise<Workflow> {
    const validatedData = CreateWorkflowSchema.parse(data);

    // Validate workflow structure
    const validationErrors = await this.validateWorkflowStructure(validatedData);
    if (validationErrors.length > 0) {
      throw new BadRequestException(`Workflow validation failed: ${validationErrors.join(', ')}`);
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        ...validatedData,
        userId,
        organizationId,
        nodes: validatedData.nodes,
        edges: validatedData.edges,
        triggers: validatedData.triggers,
        variables: validatedData.variables,
        settings: validatedData.settings,
        metadata: {
          createdBy: userId,
          nodeCount: validatedData.nodes.length,
          edgeCount: validatedData.edges.length,
          complexity: this.calculateComplexity(validatedData),
          estimatedExecutionTime: this.estimateExecutionTime(validatedData)
        }
      }
    });

    // Create workflow nodes in database
    if (validatedData.nodes.length > 0) {
      await this.prisma.workflowNode.createMany({
        data: validatedData.nodes.map(node => ({
          workflowId: workflow.id,
          nodeId: node.id,
          type: node.type,
          name: node.label,
          config: node.config,
          position: node.position,
          metadata: node.data
        }))
      });
    }

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_CREATED',
      workflowId: workflow.id,
      organizationId,
      data: workflow
    });

    return workflow;
  }

  async getWorkflows(
    organizationId: string,
    filters?: {
      status?: string;
      tags?: string[];
      search?: string;
      isTemplate?: boolean;
    }
  ): Promise<Workflow[]> {
    const where: any = { organizationId, isActive: true };

    if (filters?.status) {
      where.status = filters.status;
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

    if (filters?.isTemplate !== undefined) {
      where.isTemplate = filters.isTemplate;
    }

    return this.prisma.workflow.findMany({
      where,
      include: {
        nodes: true,
        executions: {
          take: 5,
          orderBy: { startedAt: 'desc' }
        },
        schedules: {
          where: { isActive: true }
        },
        _count: {
          select: { executions: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getWorkflow(id: string, organizationId: string): Promise<Workflow> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, organizationId },
      include: {
        nodes: true,
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
          include: {
            steps: {
              orderBy: { startedAt: 'asc' }
            }
          }
        },
        schedules: true
      }
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async updateWorkflow(
    id: string,
    organizationId: string,
    data: z.infer<typeof UpdateWorkflowSchema>
  ): Promise<Workflow> {
    const validatedData = UpdateWorkflowSchema.parse(data);

    const existingWorkflow = await this.prisma.workflow.findFirst({
      where: { id, organizationId }
    });

    if (!existingWorkflow) {
      throw new NotFoundException('Workflow not found');
    }

    // Validate updated workflow structure if nodes/edges changed
    if (validatedData.nodes || validatedData.edges) {
      const workflowToValidate = {
        ...existingWorkflow,
        ...validatedData
      };
      const validationErrors = await this.validateWorkflowStructure(workflowToValidate);
      if (validationErrors.length > 0) {
        throw new BadRequestException(`Workflow validation failed: ${validationErrors.join(', ')}`);
      }
    }

    // Update workflow nodes if provided
    if (validatedData.nodes) {
      await this.prisma.workflowNode.deleteMany({
        where: { workflowId: id }
      });

      if (validatedData.nodes.length > 0) {
        await this.prisma.workflowNode.createMany({
          data: validatedData.nodes.map(node => ({
            workflowId: id,
            nodeId: node.id,
            type: node.type,
            name: node.label,
            config: node.config,
            position: node.position,
            metadata: node.data
          }))
        });
      }
    }

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...validatedData,
        version: { increment: 1 },
        updatedAt: new Date(),
        metadata: {
          ...existingWorkflow.metadata,
          lastModifiedBy: organizationId,
          nodeCount: validatedData.nodes?.length || existingWorkflow.metadata?.nodeCount,
          edgeCount: validatedData.edges?.length || existingWorkflow.metadata?.edgeCount,
          complexity: validatedData.nodes ? this.calculateComplexity(validatedData) : existingWorkflow.metadata?.complexity,
          estimatedExecutionTime: validatedData.nodes ? this.estimateExecutionTime(validatedData) : existingWorkflow.metadata?.estimatedExecutionTime
        }
      }
    });

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_UPDATED',
      workflowId: workflow.id,
      organizationId,
      data: workflow
    });

    return workflow;
  }

  async deleteWorkflow(id: string, organizationId: string): Promise<void> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, organizationId }
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    // Cancel any scheduled jobs
    if (this.scheduledJobs.has(id)) {
      this.scheduledJobs.get(id).destroy();
      this.scheduledJobs.delete(id);
    }

    // Cancel active executions
    const activeExecution = this.activeExecutions.get(id);
    if (activeExecution) {
      await this.cancelExecution(activeExecution.id, organizationId);
    }

    await this.prisma.workflow.delete({
      where: { id }
    });

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_DELETED',
      workflowId: id,
      organizationId
    });
  }

  async cloneWorkflow(
    id: string,
    organizationId: string,
    userId: string,
    options?: { name?: string; description?: string }
  ): Promise<Workflow> {
    const originalWorkflow = await this.getWorkflow(id, organizationId);

    const clonedData = {
      name: options?.name || `${originalWorkflow.name} (Copy)`,
      description: options?.description || originalWorkflow.description,
      nodes: originalWorkflow.nodes,
      edges: originalWorkflow.edges,
      triggers: originalWorkflow.triggers,
      variables: originalWorkflow.variables,
      settings: originalWorkflow.settings,
      tags: originalWorkflow.tags,
      isTemplate: false
    };

    return this.createWorkflow(userId, organizationId, clonedData);
  }

  async executeWorkflow(
    id: string,
    organizationId: string,
    userId: string,
    data: z.infer<typeof ExecuteWorkflowSchema> = {}
  ): Promise<WorkflowExecution> {
    const validatedData = ExecuteWorkflowSchema.parse(data);

    const workflow = await this.getWorkflow(id, organizationId);

    // Validate workflow before execution
    const validationErrors = await this.validateWorkflow(workflow);
    if (validationErrors.length > 0) {
      throw new BadRequestException(`Cannot execute workflow: ${validationErrors.join(', ')}`);
    }

    // Check concurrent execution limits
    const activeExecutionsCount = await this.prisma.workflowExecution.count({
      where: {
        workflowId: id,
        status: ExecutionStatus.RUNNING
      }
    });

    if (activeExecutionsCount >= (workflow.settings as any).maxConcurrentExecutions) {
      throw new BadRequestException('Maximum concurrent executions reached');
    }

    // Create execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: id,
        userId,
        organizationId,
        input: validatedData.input,
        context: {
          variables: { ...workflow.variables, ...validatedData.variables },
          options: validatedData.options,
          sessionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        status: ExecutionStatus.RUNNING,
        metadata: {
          priority: validatedData.options.priority,
          timeout: validatedData.options.timeout || (workflow.settings as any).executionTimeout,
          retryOnFailure: validatedData.options.retryOnFailure ?? (workflow.settings as any).retryOnFailure,
          maxRetries: validatedData.options.maxRetries || (workflow.settings as any).maxRetries || 3
        }
      }
    });

    // Start execution asynchronously
    this.executeWorkflowAsync(execution, workflow).catch(error => {
      this.logger.error(`Workflow execution failed: ${error.message}`, error.stack);
    });

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_EXECUTION_STARTED',
      workflowId: id,
      executionId: execution.id,
      organizationId,
      data: execution
    });

    return execution;
  }

  private async executeWorkflowAsync(execution: WorkflowExecution, workflow: Workflow): Promise<void> {
    const startTime = Date.now();
    this.activeExecutions.set(workflow.id, execution);

    try {
      // Build execution graph
      const executionGraph = this.buildExecutionGraph(workflow);
      
      // Execute nodes in topological order
      const results = new Map<string, any>();
      const sessionContext = {
        sessionId: (execution.context as any).sessionId,
        variables: (execution.context as any).variables,
        organizationId: execution.organizationId,
        userId: execution.userId,
        workflowId: workflow.id,
        executionId: execution.id
      };

      for (const nodeId of executionGraph.executionOrder) {
        const node = workflow.nodes.find(n => n.nodeId === nodeId);
        if (!node) continue;

        await this.apix.publishEvent('workflow-events', {
          type: 'WORKFLOW_NODE_STARTED',
          workflowId: workflow.id,
          executionId: execution.id,
          nodeId,
          organizationId: execution.organizationId,
          data: { nodeId, nodeName: node.name, startedAt: new Date() }
        });

        try {
          const nodeStartTime = Date.now();

          // Prepare node input from previous results
          const nodeInput = this.prepareNodeInput(node, results, execution.input, sessionContext.variables);

          // Execute node
          const nodeContext: NodeExecutionContext = {
            nodeId,
            nodeType: node.type,
            config: node.config,
            input: nodeInput,
            variables: sessionContext.variables,
            sessionContext,
            executionId: execution.id,
            workflowId: workflow.id,
            organizationId: execution.organizationId,
            userId: execution.userId
          };

          const nodeResult = await this.executeNode(nodeContext);
          const nodeDuration = Date.now() - nodeStartTime;

          // Store result
          results.set(nodeId, nodeResult);

          // Create execution step record
          await this.prisma.workflowExecutionStep.create({
            data: {
              executionId: execution.id,
              nodeId,
              input: nodeInput,
              output: nodeResult,
              status: ExecutionStatus.COMPLETED,
              duration: nodeDuration,
              metadata: {
                nodeType: node.type,
                nodeName: node.name
              }
            }
          });

          await this.apix.publishEvent('workflow-events', {
            type: 'WORKFLOW_NODE_COMPLETED',
            workflowId: workflow.id,
            executionId: execution.id,
            nodeId,
            organizationId: execution.organizationId,
            data: {
              nodeId,
              nodeName: node.name,
              completedAt: new Date(),
              duration: nodeDuration,
              output: nodeResult
            }
          });

        } catch (nodeError) {
          const nodeDuration = Date.now() - Date.now();

          // Create failed execution step
          await this.prisma.workflowExecutionStep.create({
            data: {
              executionId: execution.id,
              nodeId,
              input: this.prepareNodeInput(node, results, execution.input, sessionContext.variables),
              error: nodeError.message,
              status: ExecutionStatus.FAILED,
              duration: nodeDuration,
              metadata: {
                nodeType: node.type,
                nodeName: node.name,
                stackTrace: nodeError.stack
              }
            }
          });

          await this.apix.publishEvent('workflow-events', {
            type: 'WORKFLOW_NODE_FAILED',
            workflowId: workflow.id,
            executionId: execution.id,
            nodeId,
            organizationId: execution.organizationId,
            data: {
              nodeId,
              nodeName: node.name,
              completedAt: new Date(),
              duration: nodeDuration,
              error: nodeError.message
            }
          });

          // Check if workflow should continue or fail
          if (!(workflow.settings as any).continueOnNodeFailure) {
            throw nodeError;
          }
        }
      }

      // Complete execution
      const totalDuration = Date.now() - startTime;
      const finalOutput = this.prepareFinalOutput(results, workflow);

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.COMPLETED,
          output: finalOutput,
          duration: totalDuration,
          completedAt: new Date()
        }
      });

      await this.apix.publishEvent('workflow-events', {
        type: 'WORKFLOW_EXECUTION_COMPLETED',
        workflowId: workflow.id,
        executionId: execution.id,
        organizationId: execution.organizationId,
        data: {
          executionId: execution.id,
          duration: totalDuration,
          output: finalOutput,
          completedAt: new Date()
        }
      });

    } catch (error) {
      const totalDuration = Date.now() - startTime;

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: error.message,
          duration: totalDuration,
          completedAt: new Date()
        }
      });

      await this.apix.publishEvent('workflow-events', {
        type: 'WORKFLOW_EXECUTION_FAILED',
        workflowId: workflow.id,
        executionId: execution.id,
        organizationId: execution.organizationId,
        data: {
          executionId: execution.id,
          duration: totalDuration,
          error: error.message,
          completedAt: new Date()
        }
      });

    } finally {
      this.activeExecutions.delete(workflow.id);
    }
  }

  async executeNode(context: NodeExecutionContext): Promise<any> {
    const { nodeType, config, input, variables, sessionContext } = context;

    switch (nodeType) {
      case NodeType.TRIGGER:
        return this.executeTriggerNode(context);
      
      case NodeType.AGENT:
        return this.executeAgentNode(context);
      
      case NodeType.TOOL:
        return this.executeToolNode(context);
      
      case NodeType.HYBRID:
        return this.executeHybridNode(context);
      
      case NodeType.CONDITION:
        return this.executeConditionNode(context);
      
      case NodeType.LOOP:
        return this.executeLoopNode(context);
      
      case NodeType.TRANSFORMER:
        return this.executeTransformerNode(context);
      
      case NodeType.HUMAN_INPUT:
        return this.executeHumanInputNode(context);
      
      case NodeType.WEBHOOK:
        return this.executeWebhookNode(context);
      
      case NodeType.SCHEDULER:
        return this.executeSchedulerNode(context);
      
      case NodeType.EMAIL:
        return this.executeEmailNode(context);
      
      case NodeType.DATABASE:
        return this.executeDatabaseNode(context);
      
      default:
        throw new BadRequestException(`Unsupported node type: ${nodeType}`);
    }
  }

  private async executeTriggerNode(context: NodeExecutionContext): Promise<any> {
    // Trigger nodes just pass through their input
    return {
      triggered: true,
      timestamp: new Date(),
      input: context.input
    };
  }

  private async executeAgentNode(context: NodeExecutionContext): Promise<any> {
    const { config, input, variables, sessionContext } = context;

    if (!config.agentId) {
      throw new BadRequestException('Agent node requires agentId in config');
    }

    // Get agent configuration
    const agent = await this.prisma.agent.findFirst({
      where: { 
        id: config.agentId, 
        organizationId: context.organizationId 
      }
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Prepare messages for agent execution
    const messages = [
      { role: 'system', content: agent.systemPrompt || 'You are a helpful AI assistant.' },
      { role: 'user', content: this.formatInputForAgent(input, config) }
    ];

    // Execute with provider
    const result = await this.providers.executeWithSmartRouting(
      context.organizationId,
      {
        messages,
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        tools: agent.tools.length > 0 ? await this.getAgentTools(agent.tools) : undefined
      },
      {
        preferredProvider: config.preferredProvider,
        maxCost: config.maxCost,
        maxLatency: config.maxLatency
      }
    );

    return {
      content: result.content,
      usage: result.usage,
      provider: result.provider,
      metadata: result.metadata
    };
  }

  private async executeToolNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    if (!config.toolId) {
      throw new BadRequestException('Tool node requires toolId in config');
    }

    // Get tool configuration
    const tool = await this.prisma.tool.findFirst({
      where: { 
        id: config.toolId, 
        organizationId: context.organizationId 
      }
    });

    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    // Validate input against tool schema
    if (tool.inputSchema) {
      // TODO: Implement schema validation
    }

    // Execute tool based on type
    switch (tool.type) {
      case 'FUNCTION_CALLER':
        return this.executeFunctionTool(tool, input, context);
      
      case 'REST_API':
        return this.executeRestApiTool(tool, input, context);
      
      case 'RAG_RETRIEVAL':
        return this.executeRagTool(tool, input, context);
      
      case 'BROWSER_AUTOMATION':
        return this.executeBrowserTool(tool, input, context);
      
      case 'DATABASE_QUERY':
        return this.executeDatabaseTool(tool, input, context);
      
      default:
        throw new BadRequestException(`Unsupported tool type: ${tool.type}`);
    }
  }

  private async executeHybridNode(context: NodeExecutionContext): Promise<any> {
    const { config, input, variables, sessionContext } = context;

    // Hybrid nodes can execute both agent and tool logic
    const results: any = {};

    // Execute agent part if configured
    if (config.agentConfig) {
      const agentContext = {
        ...context,
        config: config.agentConfig
      };
      results.agentResult = await this.executeAgentNode(agentContext);
    }

    // Execute tool part if configured
    if (config.toolConfig) {
      const toolContext = {
        ...context,
        config: config.toolConfig,
        input: config.useAgentOutput ? results.agentResult : input
      };
      results.toolResult = await this.executeToolNode(toolContext);
    }

    // Combine results based on configuration
    switch (config.outputStrategy) {
      case 'agent_only':
        return results.agentResult;
      case 'tool_only':
        return results.toolResult;
      case 'combined':
      default:
        return {
          agent: results.agentResult,
          tool: results.toolResult,
          combined: this.combineHybridResults(results.agentResult, results.toolResult, config)
        };
    }
  }

  private async executeConditionNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    const condition = config.condition;
    const result = this.evaluateCondition(condition, input, context.variables);

    return {
      condition: condition,
      result: result,
      branch: result ? 'true' : 'false',
      input: input
    };
  }

  private async executeLoopNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    const results = [];
    const maxIterations = config.maxIterations || 100;
    let iteration = 0;

    while (iteration < maxIterations) {
      const shouldContinue = this.evaluateLoopCondition(config.condition, input, context.variables, iteration);
      
      if (!shouldContinue) break;

      // Execute loop body (this would need to be implemented based on child nodes)
      const iterationResult = await this.executeLoopIteration(context, iteration);
      results.push(iterationResult);

      iteration++;
    }

    return {
      iterations: iteration,
      results: results,
      completed: iteration < maxIterations
    };
  }

  private async executeTransformerNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    const transformationType = config.transformationType;
    
    switch (transformationType) {
      case 'javascript':
        return this.executeJavaScriptTransform(config.code, input, context.variables);
      
      case 'jsonpath':
        return this.executeJsonPathTransform(config.expression, input);
      
      case 'template':
        return this.executeTemplateTransform(config.template, input, context.variables);
      
      default:
        throw new BadRequestException(`Unsupported transformation type: ${transformationType}`);
    }
  }

  private async executeHumanInputNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    // Create human input request
    const request = await this.prisma.humanInputRequest.create({
      data: {
        workflowExecutionId: context.executionId,
        requestId: `human_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt: config.prompt || 'Human input required',
        context: {
          input: input,
          variables: context.variables,
          nodeConfig: config
        },
        assignedTo: config.assignedTo,
        timeout: config.timeout ? new Date(Date.now() + config.timeout * 1000) : undefined
      }
    });

    // Publish event for human input request
    await this.apix.publishEvent('workflow-events', {
      type: 'HUMAN_INPUT_REQUESTED',
      workflowId: context.workflowId,
      executionId: context.executionId,
      nodeId: context.nodeId,
      organizationId: context.organizationId,
      data: {
        requestId: request.requestId,
        prompt: request.prompt,
        assignedTo: request.assignedTo,
        timeout: request.timeout
      }
    });

    // Wait for human response (this would be handled by a separate service)
    return this.waitForHumanInput(request.requestId, config.timeout || 3600);
  }

  private async executeWebhookNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    const axios = require('axios');

    const response = await axios({
      method: config.method || 'POST',
      url: config.url,
      data: input,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      timeout: config.timeout || 30000
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  }

  private async executeSchedulerNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    // Schedule a future execution
    const schedule = await this.prisma.workflowSchedule.create({
      data: {
        workflowId: context.workflowId,
        name: config.name || `Scheduled from ${context.nodeId}`,
        cronExpression: config.cronExpression,
        timezone: config.timezone || 'UTC',
        isActive: true,
        metadata: {
          scheduledBy: context.nodeId,
          executionId: context.executionId,
          input: input
        }
      }
    });

    this.scheduleWorkflow(schedule);

    return {
      scheduled: true,
      scheduleId: schedule.id,
      cronExpression: config.cronExpression,
      nextRun: this.getNextRunTime(config.cronExpression)
    };
  }

  private async executeEmailNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    // This would integrate with an email service
    // For now, just return a mock response
    return {
      sent: true,
      to: config.to,
      subject: config.subject,
      messageId: `msg_${Date.now()}`
    };
  }

  private async executeDatabaseNode(context: NodeExecutionContext): Promise<any> {
    const { config, input } = context;

    // This would execute database queries
    // For now, just return a mock response
    return {
      query: config.query,
      results: [],
      rowCount: 0
    };
  }

  // Helper methods for tool execution
  private async executeFunctionTool(tool: any, input: any, context: NodeExecutionContext): Promise<any> {
    // Execute custom function code
    const functionCode = tool.code;
    
    // Create safe execution environment
    const vm = require('vm');
    const sandbox = {
      input,
      context: context.variables,
      console: {
        log: (...args: any[]) => this.logger.log(`Tool ${tool.id}:`, ...args)
      }
    };

    try {
      const result = vm.runInNewContext(functionCode, sandbox, {
        timeout: 30000,
        displayErrors: true
      });

      return result;
    } catch (error) {
      throw new BadRequestException(`Function execution failed: ${error.message}`);
    }
  }

  private async executeRestApiTool(tool: any, input: any, context: NodeExecutionContext): Promise<any> {
    const axios = require('axios');

    const config = tool.config;
    const auth = tool.authentication;

    const headers: any = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    // Add authentication
    if (auth.type === 'bearer') {
      headers.Authorization = `Bearer ${auth.token}`;
    } else if (auth.type === 'api_key') {
      headers[auth.headerName || 'X-API-Key'] = auth.apiKey;
    }

    const response = await axios({
      method: config.method || 'POST',
      url: tool.endpoint,
      data: input,
      headers,
      timeout: config.timeout || 30000
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  }

  private async executeRagTool(tool: any, input: any, context: NodeExecutionContext): Promise<any> {
    const query = input.query || input.question || JSON.stringify(input);
    
    const searchResults = await this.knowledge.searchDocuments(
      tool.config.knowledgeBaseId,
      context.organizationId,
      {
        query,
        limit: tool.config.limit || 5,
        threshold: tool.config.threshold || 0.7
      }
    );

    return {
      query,
      results: searchResults.results,
      totalResults: searchResults.totalResults
    };
  }

  private async executeBrowserTool(tool: any, input: any, context: NodeExecutionContext): Promise<any> {
    // This would integrate with browser automation (Puppeteer, Playwright)
    // For now, return mock response
    return {
      action: tool.config.action,
      url: tool.config.url,
      result: 'Browser action completed',
      screenshot: null
    };
  }

  private async executeDatabaseTool(tool: any, input: any, context: NodeExecutionContext): Promise<any> {
    // This would execute database queries
    // For now, return mock response
    return {
      query: tool.config.query,
      parameters: input,
      results: [],
      rowCount: 0
    };
  }

  // Workflow validation and optimization
  async validateWorkflow(workflow: Workflow): Promise<string[]> {
    const errors: string[] = [];

    // Check for trigger nodes
    const triggerNodes = workflow.nodes.filter(node => node.type === NodeType.TRIGGER);
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    }

    // Check for disconnected nodes
    const connectedNodeIds = new Set<string>();
    workflow.edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const disconnectedNodes = workflow.nodes.filter(node => 
      node.type !== NodeType.TRIGGER && !connectedNodeIds.has(node.nodeId)
    );

    if (disconnectedNodes.length > 0) {
      errors.push(`${disconnectedNodes.length} disconnected nodes found`);
    }

    // Check for cycles
    if (this.hasCycles(workflow)) {
      errors.push('Workflow contains cycles');
    }

    // Validate node configurations
    for (const node of workflow.nodes) {
      const nodeErrors = await this.validateNodeConfiguration(node);
      errors.push(...nodeErrors);
    }

    return errors;
  }

  private async validateWorkflowStructure(workflow: any): Promise<string[]> {
    const errors: string[] = [];

    // Basic structure validation
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    // Validate node IDs are unique
    const nodeIds = workflow.nodes.map((n: any) => n.id);
    const uniqueNodeIds = new Set(nodeIds);
    if (nodeIds.length !== uniqueNodeIds.size) {
      errors.push('Node IDs must be unique');
    }

    // Validate edges reference existing nodes
    if (workflow.edges) {
      for (const edge of workflow.edges) {
        if (!uniqueNodeIds.has(edge.source)) {
          errors.push(`Edge references non-existent source node: ${edge.source}`);
        }
        if (!uniqueNodeIds.has(edge.target)) {
          errors.push(`Edge references non-existent target node: ${edge.target}`);
        }
      }
    }

    return errors;
  }

  private async validateNodeConfiguration(node: any): Promise<string[]> {
    const errors: string[] = [];

    switch (node.type) {
      case NodeType.AGENT:
        if (!node.config.agentId) {
          errors.push(`Agent node ${node.nodeId} missing agentId`);
        }
        break;
      
      case NodeType.TOOL:
        if (!node.config.toolId) {
          errors.push(`Tool node ${node.nodeId} missing toolId`);
        }
        break;
      
      case NodeType.CONDITION:
        if (!node.config.condition) {
          errors.push(`Condition node ${node.nodeId} missing condition`);
        }
        break;
      
      case NodeType.WEBHOOK:
        if (!node.config.url) {
          errors.push(`Webhook node ${node.nodeId} missing URL`);
        }
        break;
    }

    return errors;
  }

  private hasCycles(workflow: Workflow): boolean {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recStack = new Set<string>();

    // Build adjacency list
    workflow.nodes.forEach(node => graph.set(node.nodeId, []));
    workflow.edges.forEach(edge => {
      const neighbors = graph.get(edge.source) || [];
      neighbors.push(edge.target);
      graph.set(edge.source, neighbors);
    });

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.nodeId)) {
        if (dfs(node.nodeId)) return true;
      }
    }

    return false;
  }

  async optimizeExecution(workflow: Workflow): Promise<any> {
    // Analyze workflow for optimization opportunities
    const optimizations = {
      parallelizableNodes: this.findParallelizableNodes(workflow),
      bottlenecks: this.identifyBottlenecks(workflow),
      redundantNodes: this.findRedundantNodes(workflow),
      suggestions: []
    };

    return optimizations;
  }

  // Scheduling functionality
  async createSchedule(
    workflowId: string,
    organizationId: string,
    data: z.infer<typeof CreateScheduleSchema>
  ): Promise<WorkflowSchedule> {
    const validatedData = CreateScheduleSchema.parse(data);

    // Validate workflow exists
    const workflow = await this.getWorkflow(workflowId, organizationId);

    // Validate cron expression
    if (!cron.validate(validatedData.cronExpression)) {
      throw new BadRequestException('Invalid cron expression');
    }

    const schedule = await this.prisma.workflowSchedule.create({
      data: {
        workflowId,
        ...validatedData,
        nextRun: this.getNextRunTime(validatedData.cronExpression),
        metadata: {
          input: validatedData.input,
          variables: validatedData.variables
        }
      }
    });

    if (validatedData.isActive) {
      this.scheduleWorkflow(schedule);
    }

    return schedule;
  }

  private initializeScheduler(): void {
    // Load existing schedules on startup
    this.loadExistingSchedules();
  }

  private async loadExistingSchedules(): Promise<void> {
    const schedules = await this.prisma.workflowSchedule.findMany({
      where: { isActive: true }
    });

    for (const schedule of schedules) {
      this.scheduleWorkflow(schedule);
    }
  }

  private scheduleWorkflow(schedule: WorkflowSchedule): void {
    if (this.scheduledJobs.has(schedule.id)) {
      this.scheduledJobs.get(schedule.id).destroy();
    }

    const task = cron.schedule(schedule.cronExpression, async () => {
      try {
        await this.executeScheduledWorkflow(schedule);
      } catch (error) {
        this.logger.error(`Scheduled workflow execution failed: ${error.message}`);
      }
    }, {
      scheduled: true,
      timezone: schedule.timezone
    });

    this.scheduledJobs.set(schedule.id, task);
  }

  private async executeScheduledWorkflow(schedule: WorkflowSchedule): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: schedule.workflowId },
      include: { nodes: true }
    });

    if (!workflow) {
      this.logger.warn(`Scheduled workflow not found: ${schedule.workflowId}`);
      return;
    }

    const metadata = schedule.metadata as any;
    
    await this.executeWorkflow(
      workflow.id,
      workflow.organizationId,
      workflow.userId,
      {
        input: metadata.input || {},
        variables: metadata.variables || {}
      }
    );

    // Update next run time
    await this.prisma.workflowSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRun: new Date(),
        nextRun: this.getNextRunTime(schedule.cronExpression)
      }
    });
  }

  private getNextRunTime(cronExpression: string): Date {
    const cronParser = require('cron-parser');
    const interval = cronParser.parseExpression(cronExpression);
    return interval.next().toDate();
  }

  // Execution management
  async getWorkflowExecutions(
    workflowId: string,
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: ExecutionStatus;
    }
  ): Promise<{ executions: WorkflowExecution[]; total: number }> {
    const where: any = { workflowId };
    
    if (options?.status) {
      where.status = options.status;
    }

    const [executions, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where,
        include: {
          steps: {
            orderBy: { startedAt: 'asc' }
          }
        },
        orderBy: { startedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0
      }),
      this.prisma.workflowExecution.count({ where })
    ]);

    return { executions, total };
  }

  async cancelExecution(executionId: string, organizationId: string): Promise<void> {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, organizationId }
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    if (execution.status !== ExecutionStatus.RUNNING) {
      throw new BadRequestException('Execution is not running');
    }

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.CANCELLED,
        completedAt: new Date()
      }
    });

    // Remove from active executions
    for (const [workflowId, activeExecution] of this.activeExecutions.entries()) {
      if (activeExecution.id === executionId) {
        this.activeExecutions.delete(workflowId);
        break;
      }
    }

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_EXECUTION_CANCELLED',
      workflowId: execution.workflowId,
      executionId,
      organizationId
    });
  }

  // Analytics and reporting
  async getWorkflowAnalytics(workflowId: string, organizationId: string, timeRange: string): Promise<any> {
    const workflow = await this.getWorkflow(workflowId, organizationId);

    const dateFilter = this.getDateFilter(timeRange);

    const [
      executionStats,
      nodePerformance,
      errorAnalysis,
      costAnalysis
    ] = await Promise.all([
      this.getExecutionStats(workflowId, dateFilter),
      this.getNodePerformance(workflowId, dateFilter),
      this.getErrorAnalysis(workflowId, dateFilter),
      this.getCostAnalysis(workflowId, dateFilter)
    ]);

    return {
      workflow,
      executionStats,
      nodePerformance,
      errorAnalysis,
      costAnalysis,
      timeRange,
      generatedAt: new Date()
    };
  }

  // Helper methods
  private buildExecutionGraph(workflow: Workflow): { executionOrder: string[] } {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize graph
    workflow.nodes.forEach(node => {
      graph.set(node.nodeId, []);
      inDegree.set(node.nodeId, 0);
    });

    // Build adjacency list and calculate in-degrees
    workflow.edges.forEach(edge => {
      const neighbors = graph.get(edge.source) || [];
      neighbors.push(edge.target);
      graph.set(edge.source, neighbors);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Topological sort
    const queue: string[] = [];
    const executionOrder: string[] = [];

    // Find nodes with no incoming edges (triggers)
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      executionOrder.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return { executionOrder };
  }

  private prepareNodeInput(node: any, results: Map<string, any>, workflowInput: any, variables: any): any {
    // Combine inputs from connected nodes
    const nodeInput: any = { ...workflowInput };

    // Add results from predecessor nodes
    results.forEach((result, nodeId) => {
      nodeInput[`node_${nodeId}`] = result;
    });

    // Add variables
    nodeInput.variables = variables;

    // Apply input mappings if configured
    if (node.config.inputMappings) {
      for (const [key, mapping] of Object.entries(node.config.inputMappings)) {
        nodeInput[key] = this.resolveMapping(mapping, nodeInput, variables);
      }
    }

    return nodeInput;
  }

  private prepareFinalOutput(results: Map<string, any>, workflow: Workflow): any {
    const output: any = {};

    // Include results from all nodes
    results.forEach((result, nodeId) => {
      output[nodeId] = result;
    });

    // Apply output mappings if configured
    if ((workflow.settings as any).outputMappings) {
      const mappings = (workflow.settings as any).outputMappings;
      for (const [key, mapping] of Object.entries(mappings)) {
        output[key] = this.resolveMapping(mapping, output, workflow.variables);
      }
    }

    return output;
  }

  private resolveMapping(mapping: any, data: any, variables: any): any {
    // Simple mapping resolution - in production, use a proper expression engine
    if (typeof mapping === 'string') {
      if (mapping.startsWith('$')) {
        const path = mapping.substring(1);
        return this.getNestedValue(data, path);
      }
      if (mapping.startsWith('var.')) {
        const varName = mapping.substring(4);
        return variables[varName];
      }
    }
    return mapping;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private formatInputForAgent(input: any, config: any): string {
    if (config.inputTemplate) {
      return this.renderTemplate(config.inputTemplate, input);
    }
    
    if (typeof input === 'string') {
      return input;
    }
    
    return JSON.stringify(input, null, 2);
  }

  private renderTemplate(template: string, data: any): string {
    // Simple template rendering - in production, use a proper template engine
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private async getAgentTools(toolIds: string[]): Promise<any[]> {
    const tools = await this.prisma.tool.findMany({
      where: { id: { in: toolIds } }
    });

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  private combineHybridResults(agentResult: any, toolResult: any, config: any): any {
    // Combine agent and tool results based on configuration
    switch (config.combineStrategy) {
      case 'merge':
        return { ...agentResult, ...toolResult };
      case 'agent_primary':
        return { ...toolResult, ...agentResult };
      case 'structured':
      default:
        return {
          agent: agentResult,
          tool: toolResult
        };
    }
  }

  private evaluateCondition(condition: any, input: any, variables: any): boolean {
    // Simple condition evaluation - in production, use a proper expression engine
    try {
      const vm = require('vm');
      const context = { input, variables, ...input };
      return vm.runInNewContext(condition, context, { timeout: 1000 });
    } catch (error) {
      this.logger.warn(`Condition evaluation failed: ${error.message}`);
      return false;
    }
  }

  private evaluateLoopCondition(condition: any, input: any, variables: any, iteration: number): boolean {
    try {
      const vm = require('vm');
      const context = { input, variables, iteration, ...input };
      return vm.runInNewContext(condition, context, { timeout: 1000 });
    } catch (error) {
      this.logger.warn(`Loop condition evaluation failed: ${error.message}`);
      return false;
    }
  }

  private async executeLoopIteration(context: NodeExecutionContext, iteration: number): Promise<any> {
    // This would execute the loop body nodes
    // For now, return a simple result
    return {
      iteration,
      timestamp: new Date(),
      input: context.input
    };
  }

  private executeJavaScriptTransform(code: string, input: any, variables: any): any {
    const vm = require('vm');
    const sandbox = {
      input,
      variables,
      output: null,
      JSON,
      Math,
      Date,
      console: {
        log: (...args: any[]) => this.logger.log('Transform:', ...args)
      }
    };

    try {
      vm.runInNewContext(code, sandbox, {
        timeout: 10000,
        displayErrors: true
      });

      return sandbox.output || input;
    } catch (error) {
      throw new BadRequestException(`JavaScript transform failed: ${error.message}`);
    }
  }

  private executeJsonPathTransform(expression: string, input: any): any {
    const JSONPath = require('jsonpath');
    try {
      return JSONPath.query(input, expression);
    } catch (error) {
      throw new BadRequestException(`JSONPath transform failed: ${error.message}`);
    }
  }

  private executeTemplateTransform(template: string, input: any, variables: any): any {
    // Simple template transformation
    const data = { ...input, ...variables };
    return this.renderTemplate(template, data);
  }

  private async waitForHumanInput(requestId: string, timeoutSeconds: number): Promise<any> {
    // This would wait for human input response
    // For now, return a timeout response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          requestId,
          response: null,
          timedOut: true,
          timestamp: new Date()
        });
      }, Math.min(timeoutSeconds * 1000, 60000)); // Max 1 minute for demo
    });
  }

  private calculateComplexity(workflow: any): number {
    const nodeCount = workflow.nodes?.length || 0;
    const edgeCount = workflow.edges?.length || 0;
    const conditionNodes = workflow.nodes?.filter((n: any) => n.type === 'CONDITION').length || 0;
    const loopNodes = workflow.nodes?.filter((n: any) => n.type === 'LOOP').length || 0;

    return nodeCount + edgeCount + (conditionNodes * 2) + (loopNodes * 3);
  }

  private estimateExecutionTime(workflow: any): number {
    // Simple estimation based on node types
    const nodeTypeWeights = {
      TRIGGER: 100,
      AGENT: 5000,
      TOOL: 2000,
      HYBRID: 7000,
      CONDITION: 50,
      LOOP: 1000,
      TRANSFORMER: 200,
      HUMAN_INPUT: 30000,
      WEBHOOK: 1000,
      SCHEDULER: 100,
      EMAIL: 500,
      DATABASE: 300
    };

    let totalTime = 0;
    for (const node of workflow.nodes || []) {
      totalTime += nodeTypeWeights[node.type as keyof typeof nodeTypeWeights] || 1000;
    }

    return totalTime;
  }

  private findParallelizableNodes(workflow: Workflow): string[] {
    // Find nodes that can be executed in parallel
    const parallelizable: string[] = [];
    
    // Simple heuristic: nodes with no dependencies can be parallelized
    const dependencies = new Map<string, string[]>();
    
    workflow.edges.forEach(edge => {
      if (!dependencies.has(edge.target)) {
        dependencies.set(edge.target, []);
      }
      dependencies.get(edge.target)!.push(edge.source);
    });

    workflow.nodes.forEach(node => {
      const deps = dependencies.get(node.nodeId) || [];
      if (deps.length <= 1) {
        parallelizable.push(node.nodeId);
      }
    });

    return parallelizable;
  }

  private identifyBottlenecks(workflow: Workflow): any[] {
    // Identify potential bottlenecks
    const bottlenecks: any[] = [];

    workflow.nodes.forEach(node => {
      if (node.type === NodeType.HUMAN_INPUT) {
        bottlenecks.push({
          nodeId: node.nodeId,
          type: 'human_input',
          severity: 'high',
          description: 'Human input nodes can cause significant delays'
        });
      }

      if (node.type === NodeType.AGENT && (node.config as any)?.model?.includes('gpt-4')) {
        bottlenecks.push({
          nodeId: node.nodeId,
          type: 'slow_model',
          severity: 'medium',
          description: 'GPT-4 models have higher latency'
        });
      }
    });

    return bottlenecks;
  }

  private findRedundantNodes(workflow: Workflow): string[] {
    // Find potentially redundant nodes
    const redundant: string[] = [];

    // Simple heuristic: nodes with identical configurations
    const nodeConfigs = new Map<string, string[]>();

    workflow.nodes.forEach(node => {
      const configKey = JSON.stringify({ type: node.type, config: node.config });
      if (!nodeConfigs.has(configKey)) {
        nodeConfigs.set(configKey, []);
      }
      nodeConfigs.get(configKey)!.push(node.nodeId);
    });

    nodeConfigs.forEach(nodeIds => {
      if (nodeIds.length > 1) {
        redundant.push(...nodeIds.slice(1));
      }
    });

    return redundant;
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

  private async getExecutionStats(workflowId: string, dateFilter: any): Promise<any> {
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        workflowId,
        startedAt: dateFilter
      }
    });

    const total = executions.length;
    const successful = executions.filter(e => e.status === ExecutionStatus.COMPLETED).length;
    const failed = executions.filter(e => e.status === ExecutionStatus.FAILED).length;
    const avgDuration = executions
      .filter(e => e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0) / executions.length || 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDuration
    };
  }

  private async getNodePerformance(workflowId: string, dateFilter: any): Promise<any[]> {
    const steps = await this.prisma.workflowExecutionStep.findMany({
      where: {
        execution: {
          workflowId,
          startedAt: dateFilter
        }
      }
    });

    const nodeStats = new Map<string, any>();

    steps.forEach(step => {
      if (!nodeStats.has(step.nodeId)) {
        nodeStats.set(step.nodeId, {
          nodeId: step.nodeId,
          executions: 0,
          totalDuration: 0,
          errors: 0
        });
      }

      const stats = nodeStats.get(step.nodeId);
      stats.executions++;
      stats.totalDuration += step.duration || 0;
      if (step.status === ExecutionStatus.FAILED) {
        stats.errors++;
      }
    });

    return Array.from(nodeStats.values()).map(stats => ({
      ...stats,
      avgDuration: stats.executions > 0 ? stats.totalDuration / stats.executions : 0,
      errorRate: stats.executions > 0 ? stats.errors / stats.executions : 0
    }));
  }

  private async getErrorAnalysis(workflowId: string, dateFilter: any): Promise<any[]> {
    const failedSteps = await this.prisma.workflowExecutionStep.findMany({
      where: {
        execution: {
          workflowId,
          startedAt: dateFilter
        },
        status: ExecutionStatus.FAILED
      }
    });

    const errorCounts = new Map<string, number>();

    failedSteps.forEach(step => {
      const error = step.error || 'Unknown error';
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);
  }

  private async getCostAnalysis(workflowId: string, dateFilter: any): Promise<any> {
    // This would calculate costs based on provider usage
    // For now, return mock data
    return {
      totalCost: 0,
      costByProvider: [],
      costByNode: []
    };
  }
}