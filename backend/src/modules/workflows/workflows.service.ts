import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { AgentsService } from '../agents/agents.service';
import { ToolsService } from '../tools/tools.service';
import { 
  Workflow, 
  WorkflowExecution, 
  WorkflowExecutionStep,
  ExecutionStatus, 
  NodeType,
  WorkflowNode 
} from '@prisma/client';
import { z } from 'zod';

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
  triggers: z.array(z.any()).default([]),
  variables: z.record(z.any()).default({}),
  settings: z.record(z.any()).default({})
});

const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

const ExecuteWorkflowSchema = z.object({
  input: z.record(z.any()).default({}),
  context: z.record(z.any()).default({})
});

@Injectable()
export class WorkflowsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService,
    private agentsService: AgentsService,
    private toolsService: ToolsService
  ) {}

  async createWorkflow(
    userId: string, 
    organizationId: string, 
    data: z.infer<typeof CreateWorkflowSchema>
  ): Promise<Workflow> {
    const validatedData = CreateWorkflowSchema.parse(data);

    const workflow = await this.prisma.workflow.create({
      data: {
        ...validatedData,
        userId,
        organizationId,
        nodes: validatedData.nodes,
        edges: validatedData.edges,
        triggers: validatedData.triggers,
        variables: validatedData.variables,
        settings: validatedData.settings
      }
    });

    // Create workflow nodes
    if (validatedData.nodes && validatedData.nodes.length > 0) {
      await this.createWorkflowNodes(workflow.id, validatedData.nodes);
    }

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_CREATED',
      workflowId: workflow.id,
      organizationId,
      data: workflow
    });

    return workflow;
  }

  async getWorkflows(organizationId: string, filters?: {
    isActive?: boolean;
    search?: string;
  }): Promise<Workflow[]> {
    const where: any = { organizationId };

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return this.prisma.workflow.findMany({
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
        nodes: {
          include: {
            agent: {
              select: { id: true, name: true, type: true }
            },
            tool: {
              select: { id: true, name: true, type: true }
            }
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

  async getWorkflow(id: string, organizationId: string): Promise<Workflow> {
    const workflow = await this.prisma.workflow.findFirst({
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
        nodes: {
          include: {
            agent: true,
            tool: true
          }
        },
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
          include: {
            steps: {
              orderBy: { startedAt: 'asc' }
            }
          }
        }
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

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...validatedData,
        version: existingWorkflow.version + 1,
        updatedAt: new Date()
      }
    });

    // Update workflow nodes if provided
    if (validatedData.nodes) {
      await this.prisma.workflowNode.deleteMany({
        where: { workflowId: id }
      });
      await this.createWorkflowNodes(id, validatedData.nodes);
    }

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

    await this.prisma.workflow.delete({
      where: { id }
    });

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_DELETED',
      workflowId: id,
      organizationId
    });
  }

  async executeWorkflow(
    workflowId: string,
    organizationId: string,
    userId: string,
    data: z.infer<typeof ExecuteWorkflowSchema>
  ): Promise<WorkflowExecution> {
    const validatedData = ExecuteWorkflowSchema.parse(data);

    const workflow = await this.getWorkflow(workflowId, organizationId);

    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        userId,
        organizationId,
        input: validatedData.input,
        context: validatedData.context,
        status: ExecutionStatus.RUNNING
      }
    });

    await this.apix.publishEvent('workflow-events', {
      type: 'WORKFLOW_EXECUTION_STARTED',
      workflowId,
      executionId: execution.id,
      organizationId
    });

    // Execute workflow asynchronously
    this.executeWorkflowAsync(execution, workflow).catch(error => {
      console.error('Workflow execution failed:', error);
    });

    return execution;
  }

  private async executeWorkflowAsync(
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const nodes = workflow.nodes as any[];
      const edges = workflow.edges as any[];
      const context = { ...execution.context, ...execution.input };

      // Build execution graph
      const executionGraph = this.buildExecutionGraph(nodes, edges);
      
      // Execute nodes in topological order
      const results = await this.executeNodes(
        execution.id,
        executionGraph,
        context,
        workflow.organizationId
      );

      const duration = Date.now() - startTime;

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.COMPLETED,
          output: results,
          completedAt: new Date(),
          duration
        }
      });

      await this.apix.publishEvent('workflow-events', {
        type: 'WORKFLOW_EXECUTION_COMPLETED',
        workflowId: workflow.id,
        executionId: execution.id,
        organizationId: workflow.organizationId,
        output: results,
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: error.message,
          completedAt: new Date(),
          duration
        }
      });

      await this.apix.publishEvent('workflow-events', {
        type: 'WORKFLOW_EXECUTION_FAILED',
        workflowId: workflow.id,
        executionId: execution.id,
        organizationId: workflow.organizationId,
        error: error.message
      });
    }
  }

  private buildExecutionGraph(nodes: any[], edges: any[]): Map<string, any> {
    const graph = new Map();

    // Initialize nodes
    nodes.forEach(node => {
      graph.set(node.id, {
        ...node,
        dependencies: [],
        dependents: []
      });
    });

    // Build dependencies
    edges.forEach(edge => {
      const sourceNode = graph.get(edge.source);
      const targetNode = graph.get(edge.target);

      if (sourceNode && targetNode) {
        targetNode.dependencies.push(edge.source);
        sourceNode.dependents.push(edge.target);
      }
    });

    return graph;
  }

  private async executeNodes(
    executionId: string,
    graph: Map<string, any>,
    context: any,
    organizationId: string
  ): Promise<any> {
    const executed = new Set<string>();
    const results: any = {};
    const queue: string[] = [];

    // Find starting nodes (no dependencies)
    graph.forEach((node, nodeId) => {
      if (node.dependencies.length === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = graph.get(nodeId)!;

      if (executed.has(nodeId)) continue;

      // Check if all dependencies are executed
      const allDepsExecuted = node.dependencies.every((dep: string) => executed.has(dep));
      if (!allDepsExecuted) continue;

      try {
        // Execute node
        const stepResult = await this.executeWorkflowNode(
          executionId,
          node,
          context,
          results,
          organizationId
        );

        results[nodeId] = stepResult;
        executed.add(nodeId);

        // Add dependents to queue
        node.dependents.forEach((dependent: string) => {
          if (!executed.has(dependent) && !queue.includes(dependent)) {
            queue.push(dependent);
          }
        });

      } catch (error) {
        throw new Error(`Node ${nodeId} execution failed: ${error.message}`);
      }
    }

    return results;
  }

  private async executeWorkflowNode(
    executionId: string,
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    const step = await this.prisma.workflowExecutionStep.create({
      data: {
        executionId,
        nodeId: node.id,
        input: { context, previousResults },
        status: ExecutionStatus.RUNNING
      }
    });

    const startTime = Date.now();

    try {
      let result: any;

      switch (node.type) {
        case NodeType.AGENT:
          result = await this.executeAgentNode(node, context, previousResults, organizationId);
          break;

        case NodeType.TOOL:
          result = await this.executeToolNode(node, context, previousResults, organizationId);
          break;

        case NodeType.HYBRID:
          result = await this.executeHybridNode(node, context, previousResults, organizationId);
          break;

        case NodeType.CONDITION:
          result = await this.executeConditionNode(node, context, previousResults);
          break;

        case NodeType.LOOP:
          result = await this.executeLoopNode(node, context, previousResults, organizationId);
          break;

        case NodeType.HUMAN_INPUT:
          result = await this.executeHumanInputNode(node, context, previousResults);
          break;

        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      const duration = Date.now() - startTime;

      await this.prisma.workflowExecutionStep.update({
        where: { id: step.id },
        data: {
          output: result,
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
          duration
        }
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      await this.prisma.workflowExecutionStep.update({
        where: { id: step.id },
        data: {
          error: error.message,
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
          duration
        }
      });

      throw error;
    }
  }

  private async executeAgentNode(
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    const agentId = node.data?.agentId || node.agentId;
    if (!agentId) {
      throw new Error('Agent node requires agentId');
    }

    const message = this.interpolateTemplate(
      node.data?.message || 'Process the following data: {{input}}',
      { context, previousResults, input: context }
    );

    const result = await this.agentsService.executeAgent(
      agentId,
      organizationId,
      {
        message,
        context: { ...context, previousResults },
        stream: false
      }
    );

    return {
      sessionId: result.sessionId,
      response: result.response,
      timestamp: new Date().toISOString()
    };
  }

  private async executeToolNode(
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    const toolId = node.data?.toolId || node.toolId;
    if (!toolId) {
      throw new Error('Tool node requires toolId');
    }

    const input = this.interpolateTemplate(
      node.data?.input || context,
      { context, previousResults }
    );

    const execution = await this.toolsService.executeTool(
      toolId,
      organizationId,
      {
        input,
        context: { ...context, previousResults }
      }
    );

    return {
      executionId: execution.id,
      output: execution.output,
      status: execution.status,
      timestamp: new Date().toISOString()
    };
  }

  private async executeHybridNode(
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    const config = node.data || {};
    const mode = config.mode || 'agent-first';

    switch (mode) {
      case 'agent-first':
        return this.executeAgentFirstHybrid(node, context, previousResults, organizationId);
      
      case 'tool-first':
        return this.executeToolFirstHybrid(node, context, previousResults, organizationId);
      
      case 'parallel':
        return this.executeParallelHybrid(node, context, previousResults, organizationId);
      
      default:
        throw new Error(`Unsupported hybrid mode: ${mode}`);
    }
  }

  private async executeAgentFirstHybrid(
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    // Execute agent first, then use tools based on agent's decision
    const agentResult = await this.executeAgentNode(node, context, previousResults, organizationId);
    
    // Parse agent response for tool calls
    const toolCalls = this.parseToolCalls(agentResult.response);
    const toolResults = [];

    for (const toolCall of toolCalls) {
      if (toolCall.toolId) {
        const toolResult = await this.executeToolNode(
          { data: { toolId: toolCall.toolId, input: toolCall.input } },
          context,
          { ...previousResults, agentResult },
          organizationId
        );
        toolResults.push(toolResult);
      }
    }

    return {
      mode: 'agent-first',
      agentResult,
      toolResults,
      timestamp: new Date().toISOString()
    };
  }

  private async executeToolFirstHybrid(
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    // Execute tools first, then process results with agent
    const toolIds = node.data?.toolIds || [];
    const toolResults = [];

    for (const toolId of toolIds) {
      const toolResult = await this.executeToolNode(
        { data: { toolId, input: context } },
        context,
        previousResults,
        organizationId
      );
      toolResults.push(toolResult);
    }

    // Process tool results with agent
    const agentResult = await this.executeAgentNode(
      {
        ...node,
        data: {
          ...node.data,
          message: `Process the following tool results: ${JSON.stringify(toolResults)}`
        }
      },
      context,
      { ...previousResults, toolResults },
      organizationId
    );

    return {
      mode: 'tool-first',
      toolResults,
      agentResult,
      timestamp: new Date().toISOString()
    };
  }

  private async executeParallelHybrid(
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    // Execute agent and tools in parallel
    const promises = [];

    // Agent execution
    if (node.data?.agentId) {
      promises.push(
        this.executeAgentNode(node, context, previousResults, organizationId)
          .then(result => ({ type: 'agent', result }))
      );
    }

    // Tool executions
    const toolIds = node.data?.toolIds || [];
    toolIds.forEach((toolId: string) => {
      promises.push(
        this.executeToolNode(
          { data: { toolId, input: context } },
          context,
          previousResults,
          organizationId
        ).then(result => ({ type: 'tool', toolId, result }))
      );
    });

    const results = await Promise.all(promises);
    
    const agentResults = results.filter(r => r.type === 'agent').map(r => r.result);
    const toolResults = results.filter(r => r.type === 'tool');

    return {
      mode: 'parallel',
      agentResults,
      toolResults,
      timestamp: new Date().toISOString()
    };
  }

  private async executeConditionNode(
    node: any,
    context: any,
    previousResults: any
  ): Promise<any> {
    const condition = node.data?.condition;
    if (!condition) {
      throw new Error('Condition node requires condition');
    }

    const result = this.evaluateCondition(condition, { context, previousResults });

    return {
      condition,
      result,
      timestamp: new Date().toISOString()
    };
  }

  private async executeLoopNode(
    node: any,
    context: any,
    previousResults: any,
    organizationId: string
  ): Promise<any> {
    const config = node.data || {};
    const maxIterations = config.maxIterations || 10;
    const condition = config.condition;
    
    const results = [];
    let iteration = 0;

    while (iteration < maxIterations) {
      if (condition && !this.evaluateCondition(condition, { context, previousResults, iteration })) {
        break;
      }

      // Execute loop body (would need to define sub-nodes)
      const iterationResult = {
        iteration,
        context: { ...context, iteration },
        timestamp: new Date().toISOString()
      };

      results.push(iterationResult);
      iteration++;
    }

    return {
      iterations: iteration,
      results,
      timestamp: new Date().toISOString()
    };
  }

  private async executeHumanInputNode(
    node: any,
    context: any,
    previousResults: any
  ): Promise<any> {
    // In a real implementation, this would pause execution and wait for human input
    // For now, we'll simulate with a timeout and default response
    
    const config = node.data || {};
    const prompt = config.prompt || 'Human input required';
    const timeout = config.timeout || 300000; // 5 minutes

    // Store the pending human input request
    const requestId = `human_input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.redis.set(
      `human_input:${requestId}`,
      JSON.stringify({
        prompt,
        context,
        previousResults,
        timestamp: new Date().toISOString()
      }),
      timeout / 1000
    );

    return {
      requestId,
      prompt,
      status: 'pending',
      timestamp: new Date().toISOString()
    };
  }

  private parseToolCalls(response: string): Array<{ toolId: string; input: any }> {
    // Simple tool call parsing - in production, this would be more sophisticated
    const toolCallRegex = /\[TOOL:(\w+)\](.*?)\[\/TOOL\]/gs;
    const toolCalls = [];
    let match;

    while ((match = toolCallRegex.exec(response)) !== null) {
      try {
        const toolId = match[1];
        const input = JSON.parse(match[2]);
        toolCalls.push({ toolId, input });
      } catch (error) {
        // Skip invalid tool calls
      }
    }

    return toolCalls;
  }

  private evaluateCondition(condition: string, variables: any): boolean {
    // Simple condition evaluation - in production, use a proper expression evaluator
    try {
      const func = new Function('variables', `
        const { context, previousResults, iteration } = variables;
        return ${condition};
      `);
      return func(variables);
    } catch (error) {
      return false;
    }
  }

  private interpolateTemplate(template: any, variables: any): any {
    if (typeof template === 'string') {
      return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const value = this.getNestedValue(variables, path);
        return value !== undefined ? String(value) : match;
      });
    }
    
    if (typeof template === 'object' && template !== null) {
      const result: any = Array.isArray(template) ? [] : {};
      for (const key in template) {
        result[key] = this.interpolateTemplate(template[key], variables);
      }
      return result;
    }

    return template;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async createWorkflowNodes(workflowId: string, nodes: any[]): Promise<void> {
    const nodeData = nodes.map(node => ({
      workflowId,
      nodeId: node.id,
      type: node.type as NodeType,
      name: node.data?.label || node.id,
      config: node.data || {},
      position: node.position || { x: 0, y: 0 },
      agentId: node.data?.agentId || null,
      toolId: node.data?.toolId || null
    }));

    await this.prisma.workflowNode.createMany({
      data: nodeData
    });
  }

  async getWorkflowAnalytics(workflowId: string, organizationId: string): Promise<any> {
    const workflow = await this.getWorkflow(workflowId, organizationId);

    const totalExecutions = await this.prisma.workflowExecution.count({
      where: { workflowId }
    });

    const successfulExecutions = await this.prisma.workflowExecution.count({
      where: { workflowId, status: ExecutionStatus.COMPLETED }
    });

    const avgDuration = await this.prisma.workflowExecution.aggregate({
      where: { workflowId, status: ExecutionStatus.COMPLETED },
      _avg: { duration: true }
    });

    const recentExecutions = await this.prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        steps: {
          orderBy: { startedAt: 'asc' }
        }
      }
    });

    return {
      workflow,
      totalExecutions,
      successfulExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      avgDuration: avgDuration._avg.duration || 0,
      recentExecutions
    };
  }
}