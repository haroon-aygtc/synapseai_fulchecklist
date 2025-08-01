export interface ApixEvent {
  id: string;
  type: string;
  channel: string;
  data: any;
  metadata: {
    timestamp: Date;
    userId?: string;
    organizationId?: string;
    sessionId?: string;
    source: string;
    version?: string;
    roomId?: string;
    correlationId?: string;
    parentEventId?: string;
  };
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number;
  retryCount?: number;
  maxRetries?: number;
  streamId?: string;
  chunkIndex?: number;
  totalChunks?: number;
  isStreamEnd?: boolean;
}

export interface ApixConnection {
  id: string;
  userId: string;
  organizationId: string;
  socketId: string;
  isConnected: boolean;
  lastPingAt: Date;
  subscriptions: string[];
  metadata: {
    userAgent: string;
    ipAddress: string;
    connectionTime: Date;
    reconnectCount: number;
    permissions?: string[];
    roles?: string[];
  };
}

export interface ApixSubscription {
  id: string;
  channel: string;
  userId: string;
  organizationId: string;
  filters?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  lastEventAt?: Date;
  eventCount?: number;
  callback?: (event: ApixEvent) => void;
}

export interface ApixMetrics {
  totalConnections: number;
  activeConnections: number;
  totalEvents: number;
  eventsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  connectionsByOrganization: Record<string, number>;
  eventsByChannel: Record<string, number>;
  timestamp: Date;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  systemHealth?: {
    cpu: number;
    memory: number;
    uptime: number;
  };
}

export interface ApixStreamChunk {
  streamId: string;
  chunkIndex: number;
  totalChunks: number;
  data: any;
  isComplete: boolean;
  timestamp: Date;
}

export interface ApixRateLimit {
  key: string;
  limit: number;
  window: number;
  current: number;
  resetTime: Date;
}

export interface ApixChannelConfig {
  requiresAuth: boolean;
  permissions: string[];
  rateLimit?: ApixRateLimit;
  maxSubscribers?: number;
  retentionPeriod?: number;
}

export interface ApixEventFilter {
  type?: string | string[];
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeRange?: {
    start: Date;
    end: Date;
  };
  customFilters?: Record<string, any>;
}

export interface ApixQueuedMessage {
  event: ApixEvent;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  createdAt: Date;
}

export interface ApixHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    websocket: boolean;
    redis: boolean;
    database: boolean;
    memory: boolean;
    cpu: boolean;
  };
  metrics: ApixMetrics;
  errors?: string[];
}

export enum ApixEventType {
  // Agent Events
  AGENT_CREATED = 'AGENT_CREATED',
  AGENT_UPDATED = 'AGENT_UPDATED',
  AGENT_DELETED = 'AGENT_DELETED',
  AGENT_STARTED = 'AGENT_STARTED',
  AGENT_STOPPED = 'AGENT_STOPPED',
  AGENT_MESSAGE = 'AGENT_MESSAGE',
  AGENT_ERROR = 'AGENT_ERROR',
  AGENT_STREAM_START = 'AGENT_STREAM_START',
  AGENT_STREAM_CHUNK = 'AGENT_STREAM_CHUNK',
  AGENT_STREAM_END = 'AGENT_STREAM_END',

  // Tool Events
  TOOL_CREATED = 'TOOL_CREATED',
  TOOL_UPDATED = 'TOOL_UPDATED',
  TOOL_DELETED = 'TOOL_DELETED',
  TOOL_EXECUTED = 'TOOL_EXECUTED',
  TOOL_ERROR = 'TOOL_ERROR',
  TOOL_STREAM_START = 'TOOL_STREAM_START',
  TOOL_STREAM_CHUNK = 'TOOL_STREAM_CHUNK',
  TOOL_STREAM_END = 'TOOL_STREAM_END',

  // Workflow Events
  WORKFLOW_CREATED = 'WORKFLOW_CREATED',
  WORKFLOW_UPDATED = 'WORKFLOW_UPDATED',
  WORKFLOW_DELETED = 'WORKFLOW_DELETED',
  WORKFLOW_STARTED = 'WORKFLOW_STARTED',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  WORKFLOW_PAUSED = 'WORKFLOW_PAUSED',
  WORKFLOW_RESUMED = 'WORKFLOW_RESUMED',
  WORKFLOW_NODE_EXECUTED = 'WORKFLOW_NODE_EXECUTED',
  WORKFLOW_NODE_FAILED = 'WORKFLOW_NODE_FAILED',

  // Provider Events
  PROVIDER_CONNECTED = 'PROVIDER_CONNECTED',
  PROVIDER_DISCONNECTED = 'PROVIDER_DISCONNECTED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
  PROVIDER_FALLBACK = 'PROVIDER_FALLBACK',

  // System Events
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_HEALTH_CHECK = 'SYSTEM_HEALTH_CHECK',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',

  // User Events
  USER_CONNECTED = 'USER_CONNECTED',
  USER_DISCONNECTED = 'USER_DISCONNECTED',
  USER_ACTION = 'USER_ACTION',

  // Organization Events
  ORG_CREATED = 'ORG_CREATED',
  ORG_UPDATED = 'ORG_UPDATED',
  ORG_DELETED = 'ORG_DELETED',
  ORG_USER_ADDED = 'ORG_USER_ADDED',
  ORG_USER_REMOVED = 'ORG_USER_REMOVED',

  // Custom Events
  CUSTOM_EVENT = 'CUSTOM_EVENT',
  BROADCAST = 'BROADCAST',
  STREAM_DATA = 'STREAM_DATA'
}

export enum ApixChannel {
  AGENT_EVENTS = 'agent-events',
  TOOL_EVENTS = 'tool-events',
  WORKFLOW_EVENTS = 'workflow-events',
  PROVIDER_EVENTS = 'provider-events',
  SYSTEM_EVENTS = 'system-events',
  USER_EVENTS = 'user-events',
  ORGANIZATION_EVENTS = 'organization-events',
  STREAMING = 'streaming',
  CUSTOM = 'custom'
}