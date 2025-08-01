export enum AgentType {
  STANDALONE = 'STANDALONE',
  TOOL_DRIVEN = 'TOOL_DRIVEN',
  HYBRID = 'HYBRID',
  MULTI_TASK = 'MULTI_TASK',
  MULTI_PROVIDER = 'MULTI_PROVIDER'
}

export enum AgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
  COMPLETED = 'COMPLETED'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  code: string;
  version: string;
  isActive: boolean;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: AgentType;
  configuration: AgentConfiguration;
  skills: AgentSkill[];
  tags: string[];
  isPublic: boolean;
  downloads: number;
  rating: number;
  createdBy: string;
  createdAt: Date;
}

export interface AgentConfiguration {
  name: string;
  description: string;
  type: AgentType;
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: string[];
  skills: string[];
  memorySettings: {
    enabled: boolean;
    maxSize: number;
    pruningStrategy: 'fifo' | 'lru' | 'intelligent';
    persistentMemory: boolean;
  };
  collaborationSettings: {
    allowAgentToAgent: boolean;
    maxCollaborators: number;
    shareMemory: boolean;
  };
  securitySettings: {
    allowedDomains: string[];
    rateLimits: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
    dataRetention: number;
  };
}

export interface Agent {
  id: string;
  organizationId: string;
  createdBy: string;
  configuration: AgentConfiguration;
  version: string;
  isActive: boolean;
  isPublic: boolean;
  tags: string[];
  metadata: Record<string, any>;
  performance: AgentPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentPerformance {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageResponseTime: number;
  averageTokenUsage: number;
  lastExecutionAt?: Date;
  uptime: number;
  errorRate: number;
}

export interface AgentSession {
  id: string;
  agentId: string;
  userId: string;
  organizationId: string;
  status: AgentStatus;
  context: Record<string, any>;
  memory: AgentMemory;
  tasks: AgentTask[];
  collaborators: string[];
  roomId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date;
}

export interface AgentMemory {
  shortTerm: Record<string, any>;
  longTerm: Record<string, any>;
  episodic: AgentEpisode[];
  semantic: Record<string, any>;
  working: Record<string, any>;
  metadata: {
    totalSize: number;
    lastPruned: Date;
    version: number;
  };
}

export interface AgentEpisode {
  id: string;
  timestamp: Date;
  event: string;
  data: Record<string, any>;
  importance: number;
  tags: string[];
}

export interface AgentTask {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  status: TaskStatus;
  priority: number;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  progress: number;
  estimatedDuration?: number;
  actualDuration?: number;
  dependencies: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentCollaboration {
  id: string;
  roomId: string;
  participants: string[];
  sharedMemory: Record<string, any>;
  messageHistory: AgentMessage[];
  createdAt: Date;
  lastActivityAt: Date;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId?: string;
  type: 'request' | 'response' | 'broadcast' | 'system';
  content: any;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface AgentRoom {
  id: string;
  name: string;
  organizationId: string;
  participants: string[];
  settings: {
    maxParticipants: number;
    allowGuestAgents: boolean;
    memorySharing: boolean;
    messageRetention: number;
  };
  createdAt: Date;
  lastActivityAt: Date;
}

export interface AgentDebugSession {
  id: string;
  agentId: string;
  sessionId: string;
  userId: string;
  mode: 'step' | 'breakpoint' | 'trace';
  breakpoints: AgentBreakpoint[];
  variables: Record<string, any>;
  callStack: AgentStackFrame[];
  isActive: boolean;
  createdAt: Date;
}

export interface AgentBreakpoint {
  id: string;
  line: number;
  condition?: string;
  isEnabled: boolean;
  hitCount: number;
}

export interface AgentStackFrame {
  id: string;
  function: string;
  file: string;
  line: number;
  variables: Record<string, any>;
}

export interface AgentAnalytics {
  agentId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  metrics: {
    executions: number;
    successRate: number;
    averageResponseTime: number;
    tokenUsage: number;
    errorCount: number;
    userSatisfaction: number;
  };
  timestamp: Date;
}

export interface AgentVersion {
  id: string;
  agentId: string;
  version: string;
  configuration: AgentConfiguration;
  changelog: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface AgentMarketplace {
  templates: AgentTemplate[];
  categories: string[];
  featured: string[];
  trending: string[];
  recentlyAdded: string[];
}

// Agent Creation Wizard Steps
export interface AgentWizardStep {
  id: string;
  title: string;
  description: string;
  component: string;
  isCompleted: boolean;
  isRequired: boolean;
  validation?: (data: any) => { isValid: boolean; errors: string[] };
}

export interface AgentWizardData {
  currentStep: number;
  steps: AgentWizardStep[];
  data: Partial<AgentConfiguration>;
  isValid: boolean;
  errors: string[];
}