export interface SDKConfig {
  apiUrl: string;
  apiKey: string;
  tenantId: string;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  enableRealtime?: boolean;
  enableAnalytics?: boolean;
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'hybrid' | 'condition' | 'loop' | 'human-approval';
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
    schema?: any;
    inputs?: WorkflowInput[];
    outputs?: WorkflowOutput[];
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional' | 'error';
  data?: {
    condition?: string;
    label?: string;
  };
}

export interface WorkflowInput {
  id: string;
  name: string;
  type: string;
  required: boolean;
  schema: any;
  defaultValue?: any;
}

export interface WorkflowOutput {
  id: string;
  name: string;
  type: string;
  schema: any;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggers: WorkflowTrigger[];
  settings: WorkflowSettings;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tenantId: string;
}

export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'scheduled' | 'webhook' | 'event';
  config: {
    cron?: string;
    webhook?: {
      url: string;
      method: string;
      headers?: Record<string, string>;
    };
    event?: {
      channel: string;
      eventType: string;
    };
  };
  enabled: boolean;
}

export interface WorkflowSettings {
  executionMode: 'linear' | 'parallel' | 'conditional';
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    retryDelay: number;
  };
  errorHandling: 'stop' | 'continue' | 'fallback';
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableTracing: boolean;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  nodeExecutions: NodeExecution[];
  metadata: {
    triggeredBy: string;
    triggerType: string;
    executionContext: Record<string, any>;
  };
}

export interface NodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  logs: ExecutionLog[];
}

export interface ExecutionLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: 'standalone' | 'tool-driven' | 'hybrid' | 'multi-task' | 'multi-provider';
  config: {
    model: string;
    provider: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    capabilities: string[];
    tools?: string[];
    memory: {
      type: 'session' | 'persistent' | 'shared';
      maxSize: number;
    };
  };
  schema: {
    input: any;
    output: any;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  type: 'function' | 'api' | 'rag' | 'browser' | 'database';
  config: {
    endpoint?: string;
    method?: string;
    headers?: Record<string, string>;
    authentication?: {
      type: 'bearer' | 'basic' | 'api-key';
      credentials: Record<string, string>;
    };
    parameters: Record<string, any>;
  };
  schema: {
    input: any;
    output: any;
    errors: any;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface FloatingAssistantConfig {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme: 'light' | 'dark' | 'auto';
  languages: string[];
  features: {
    domHighlighting: boolean;
    contextualSuggestions: boolean;
    voiceInput: boolean;
    screenCapture: boolean;
  };
  customization: {
    primaryColor: string;
    borderRadius: number;
    glassmorphism: boolean;
  };
}

export interface CommandPaletteAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string[];
  category: string;
  action: () => void | Promise<void>;
  condition?: () => boolean;
}

export interface OnboardingStep {
  id: string;
  target: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  disableBeacon?: boolean;
  hideCloseButton?: boolean;
  hideFooter?: boolean;
  showProgress?: boolean;
  showSkipButton?: boolean;
  styles?: Record<string, any>;
}

export interface FormField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date' | 'file' | 'json';
  label: string;
  description?: string;
  required: boolean;
  validation?: any;
  options?: { label: string; value: any }[];
  defaultValue?: any;
  placeholder?: string;
  disabled?: boolean;
  hidden?: boolean;
  conditional?: {
    field: string;
    value: any;
    operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
  };
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface RealtimeEvent {
  type: string;
  channel: string;
  data: Record<string, any>;
  timestamp: string;
  metadata: {
    source: string;
    tenantId: string;
    userId?: string;
  };
}