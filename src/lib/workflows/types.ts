import { AgentType } from '../agents/types';
import { z } from 'zod';

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
  ERROR = 'ERROR'
}

export enum WorkflowExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED'
}

export enum NodeType {
  AGENT = 'AGENT',
  TOOL = 'TOOL',
  HYBRID = 'HYBRID',
  CONDITION = 'CONDITION',
  LOOP = 'LOOP',
  TRIGGER = 'TRIGGER',
  HUMAN_INPUT = 'HUMAN_INPUT',
  TRANSFORMER = 'TRANSFORMER',
  CUSTOM = 'CUSTOM'
}

export enum TriggerType {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
  WEBHOOK = 'WEBHOOK',
  EVENT = 'EVENT',
  API = 'API'
}

export enum EdgeType {
  DEFAULT = 'DEFAULT',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  CONDITION_TRUE = 'CONDITION_TRUE',
  CONDITION_FALSE = 'CONDITION_FALSE',
  LOOP_CONTINUE = 'LOOP_CONTINUE',
  LOOP_EXIT = 'LOOP_EXIT'
}

export enum ExecutionMode {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
  CONDITIONAL = 'CONDITIONAL'
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    nodeType: NodeType;
    config: Record<string, any>;
    inputSchema: z.ZodSchema<any>;
    outputSchema: z.ZodSchema<any>;
    inputMappings: Record<string, string>;
    outputMappings: Record<string, string>;
    retryConfig?: {
      maxRetries: number;
      retryDelay: number;
      exponentialBackoff: boolean;
    };
    fallbackConfig?: {
      fallbackNodeId?: string;
      fallbackAction?: 'SKIP' | 'RETRY' | 'FAIL_WORKFLOW';
    };
    timeoutMs?: number;
    metadata: Record<string, any>;
  };
  style?: Record<string, any>;
  parentId?: string;
  width?: number;
  height?: number;
}

export interface AgentNode extends WorkflowNode {
  data: WorkflowNode['data'] & {
    nodeType: NodeType.AGENT;
    config: {
      agentId: string;
      agentType: AgentType;
      systemPrompt?: string;
      model?: string;
      provider?: string;
      temperature?: number;
      maxTokens?: number;
      tools?: string[];
      memoryEnabled?: boolean;
    };
  };
}

export interface ToolNode extends WorkflowNode {
  data: WorkflowNode['data'] & {
    nodeType: NodeType.TOOL;
    config: {
      toolId: string;
      toolType: string;
      parameters: Record<string, any>;
      authentication?: Record<string, any>;
    };
  };
}

export interface HybridNode extends WorkflowNode {
  data: WorkflowNode['data'] & {
    nodeType: NodeType.HYBRID;
    config: {
      agentId: string;
      toolIds: string[];
      executionMode: ExecutionMode;
      contextSharing: boolean;
      memoryEnabled: boolean;
    };
  };
}

export interface ConditionNode extends WorkflowNode {
  data: WorkflowNode['data'] & {
    nodeType: NodeType.CONDITION;
    config: {
      condition: string;
      evaluationType: 'JAVASCRIPT' | 'TEMPLATE' | 'RULE';
    };
  };
}

export interface HumanInputNode extends WorkflowNode {
  data: WorkflowNode['data'] & {
    nodeType: NodeType.HUMAN_INPUT;
    config: {
      prompt: string;
      inputType: 'TEXT' | 'CHOICE' | 'FILE' | 'APPROVAL';
      choices?: string[];
      defaultValue?: any;
      timeoutSeconds?: number;
      escalationUserId?: string;
    };
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  animated?: boolean;
  style?: Record<string, any>;
  data?: {
    condition?: string;
    priority?: number;
    metadata?: Record<string, any>;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  organizationId: string;
  createdBy: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggers: {
    type: TriggerType;
    config: Record<string, any>;
  }[];
  variables: {
    name: string;
    type: string;
    defaultValue?: any;
    scope: 'WORKFLOW' | 'EXECUTION' | 'NODE';
    secret: boolean;
  }[];
  settings: {
    executionTimeout: number;
    maxConcurrentExecutions: number;
    retryOnFailure: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    notifyOnCompletion: boolean;
    notifyOnFailure: boolean;
    notificationChannels: string[];
  };
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  trigger: {
    type: TriggerType;
    source: string;
    data: any;
  };
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: {
    message: string;
    nodeId?: string;
    stack?: string;
  };
  nodeExecutions: {
    nodeId: string;
    status: WorkflowExecutionStatus;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    input: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    retryCount: number;
  }[];
  variables: Record<string, any>;
  logs: {
    timestamp: Date;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    nodeId?: string;
    metadata?: Record<string, any>;
  }[];
  metrics: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    totalTokens?: number;
    totalCost?: number;
    averageNodeDuration?: number;
  };
  userId: string;
  organizationId: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: Omit<Workflow, 'id' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'>;
  previewImage?: string;
  complexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX';
  estimatedExecutionTime: number;
  tags: string[];
  isPublic: boolean;
  downloads: number;
  rating: number;
  createdBy: string;
  createdAt: Date;
}

export interface WorkflowStats {
  id: string;
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecutionAt?: Date;
  successRate: number;
  errorRate: number;
  averageCost?: number;
  totalTokensUsed?: number;
  mostFrequentErrors: {
    message: string;
    count: number;
    nodeId?: string;
  }[];
  nodePerformance: {
    nodeId: string;
    averageDuration: number;
    errorRate: number;
    executionCount: number;
  }[];
  updatedAt: Date;
}

export interface WorkflowSettings {
  executionTimeout: number;
  maxConcurrentExecutions: number;
  retryOnFailure: boolean;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  notifyOnCompletion: boolean;
  notifyOnFailure: boolean;
  notificationChannels: string[];
}

export interface WorkflowAnalytics {
  executionTrends: Array<{
    date: string;
    executions: number;
    successes: number;
    failures: number;
    avgDuration: number;
    cost: number;
  }>;
  peakExecutionsPerHour: number;
  mostActiveHour: string;
  nodeNames: Record<string, string>;
  nodeTypes: Record<string, string>;
  nodeCosts: Record<string, number>;
  errorLastOccurrence: Record<string, Date>;
  errorTrends: Record<string, 'increasing' | 'decreasing' | 'stable'>;
  costBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    trend: number;
  }>;
}

// Zod schemas for validation
export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(NodeType),
  label: z.string(),
  description: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: z.object({
    nodeType: z.nativeEnum(NodeType),
    config: z.record(z.any()),
    inputSchema: z.any(),
    outputSchema: z.any(),
    inputMappings: z.record(z.string()),
    outputMappings: z.record(z.string()),
    retryConfig: z.object({
      maxRetries: z.number(),
      retryDelay: z.number(),
      exponentialBackoff: z.boolean()
    }).optional(),
    fallbackConfig: z.object({
      fallbackNodeId: z.string().optional(),
      fallbackAction: z.enum(['SKIP', 'RETRY', 'FAIL_WORKFLOW']).optional()
    }).optional(),
    timeoutMs: z.number().optional(),
    metadata: z.record(z.any())
  }),
  style: z.record(z.any()).optional(),
  parentId: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});

export const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.nativeEnum(EdgeType),
  label: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.any()).optional(),
  data: z.object({
    condition: z.string().optional(),
    priority: z.number().optional(),
    metadata: z.record(z.any()).optional()
  }).optional()
});

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  status: z.nativeEnum(WorkflowStatus),
  organizationId: z.string(),
  createdBy: z.string(),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  triggers: z.array(z.object({
    type: z.nativeEnum(TriggerType),
    config: z.record(z.any())
  })),
  variables: z.array(z.object({
    name: z.string(),
    type: z.string(),
    defaultValue: z.any().optional(),
    scope: z.enum(['WORKFLOW', 'EXECUTION', 'NODE']),
    secret: z.boolean()
  })),
  settings: z.object({
    executionTimeout: z.number(),
    maxConcurrentExecutions: z.number(),
    retryOnFailure: z.boolean(),
    logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
    notifyOnCompletion: z.boolean(),
    notifyOnFailure: z.boolean(),
    notificationChannels: z.array(z.string())
  }),
  tags: z.array(z.string()),
  metadata: z.record(z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().optional()
});

export const workflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowVersion: z.string(),
  status: z.nativeEnum(WorkflowExecutionStatus),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  duration: z.number().optional(),
  trigger: z.object({
    type: z.nativeEnum(TriggerType),
    source: z.string(),
    data: z.any()
  }),
  input: z.record(z.any()),
  output: z.record(z.any()).optional(),
  error: z.object({
    message: z.string(),
    nodeId: z.string().optional(),
    stack: z.string().optional()
  }).optional(),
  nodeExecutions: z.array(z.object({
    nodeId: z.string(),
    status: z.nativeEnum(WorkflowExecutionStatus),
    startedAt: z.date(),
    completedAt: z.date().optional(),
    duration: z.number().optional(),
    input: z.record(z.any()),
    output: z.record(z.any()).optional(),
    error: z.string().optional(),
    retryCount: z.number()
  })),
  variables: z.record(z.any()),
  logs: z.array(z.object({
    timestamp: z.date(),
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
    message: z.string(),
    nodeId: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })),
  metrics: z.object({
    totalNodes: z.number(),
    completedNodes: z.number(),
    failedNodes: z.number(),
    totalTokens: z.number().optional(),
    totalCost: z.number().optional(),
    averageNodeDuration: z.number().optional()
  }),
  userId: z.string(),
  organizationId: z.string()
});