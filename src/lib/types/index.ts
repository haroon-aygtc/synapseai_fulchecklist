export interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  status: AgentStatus;
  configuration: AgentConfiguration;
  capabilities: AgentCapability[];
  providers: AgentProvider[];
  tools: string[];
  memory: AgentMemory;
  analytics: AgentAnalytics;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isTemplate: boolean;
  templateCategory?: string;
  tags: string[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  status: ToolStatus;
  configuration: ToolConfiguration;
  schema: ToolSchema;
  authentication?: ToolAuthentication;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isTemplate: boolean;
  templateCategory?: string;
  tags: string[];
  usage: ToolUsage;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  triggers: WorkflowTrigger[];
  settings: WorkflowSettings;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isTemplate: boolean;
  templateCategory?: string;
  tags: string[];
  analytics: WorkflowAnalytics;
}

export enum AgentType {
  STANDALONE = 'STANDALONE',
  TOOL_DRIVEN = 'TOOL_DRIVEN',
  HYBRID = 'HYBRID',
  MULTI_TASK = 'MULTI_TASK',
  MULTI_PROVIDER = 'MULTI_PROVIDER'
}

export enum AgentStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  TRAINING = 'TRAINING'
}

export enum ToolType {
  FUNCTION_CALLER = 'FUNCTION_CALLER',
  REST_API = 'REST_API',
  RAG_RETRIEVAL = 'RAG_RETRIEVAL',
  BROWSER_AUTOMATION = 'BROWSER_AUTOMATION',
  DATABASE_QUERY = 'DATABASE_QUERY',
  CUSTOM = 'CUSTOM'
}

export enum ToolStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR'
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
  COMPLETED = 'COMPLETED'
}

export interface WorkflowStats {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecuted?: Date;
  errorCount: number;
}

export interface AgentConfiguration {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  responseFormat?: 'text' | 'json';
  streaming: boolean;
  timeout: number;
  retryAttempts: number;
  fallbackBehavior: 'error' | 'default_response' | 'escalate';
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface AgentProvider {
  id: string;
  name: string;
  model: string;
  priority: number;
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface AgentMemory {
  type: 'none' | 'session' | 'persistent';
  maxSize: number;
  retentionDays: number;
  configuration: Record<string, any>;
}

export interface AgentAnalytics {
  totalSessions: number;
  totalMessages: number;
  averageResponseTime: number;
  successRate: number;
  lastUsed?: Date;
  costMetrics: {
    totalCost: number;
    averageCostPerMessage: number;
    tokenUsage: {
      input: number;
      output: number;
    };
  };
}

export interface ToolConfiguration {
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  parameters?: Record<string, any>;
  timeout: number;
  retryAttempts: number;
  rateLimiting?: {
    requests: number;
    window: number;
  };
}

export interface ToolSchema {
  input: Record<string, any>;
  output: Record<string, any>;
  errors: Record<string, any>;
}

export interface ToolAuthentication {
  type: 'none' | 'api_key' | 'oauth' | 'basic' | 'bearer';
  configuration: Record<string, any>;
}

export interface ToolUsage {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  lastUsed?: Date;
  errorCount: number;
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'condition' | 'loop' | 'delay' | 'webhook' | 'start' | 'end';
  position: { x: number; y: number };
  data: {
    label: string;
    configuration: Record<string, any>;
    agentId?: string;
    toolId?: string;
  };
  status?: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional';
  condition?: string;
  label?: string;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: any;
  description?: string;
  scope: 'global' | 'local';
}

export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'webhook' | 'api';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface WorkflowSettings {
  maxExecutionTime: number;
  retryPolicy: {
    enabled: boolean;
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential';
  };
  errorHandling: {
    strategy: 'stop' | 'continue' | 'retry';
    notificationChannels: string[];
  };
  logging: {
    level: 'none' | 'basic' | 'detailed';
    retention: number;
  };
}

export interface WorkflowAnalytics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecuted?: Date;
  errorCount: number;
  costMetrics: {
    totalCost: number;
    averageCostPerExecution: number;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  triggeredBy: string;
  triggerType: string;
  nodeExecutions: NodeExecution[];
  variables: Record<string, any>;
  error?: string;
  cost: number;
}

export interface NodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  cost?: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedSetupTime: number;
  workflow: Partial<Workflow>;
  requiredIntegrations: string[];
  useCases: string[];
  author: string;
  rating: number;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
  thumbnail?: string;
}