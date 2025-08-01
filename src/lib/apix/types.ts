export interface ApixEvent {
  id: string;
  type: string;
  channel: ApixChannel;
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

export interface ApixSubscription {
  id: string;
  channel: ApixChannel;
  userId: string;
  organizationId: string;
  filters?: Record<string, any>;
  callback: (event: ApixEvent) => void;
  isActive: boolean;
  createdAt: Date;
  lastEventAt?: Date;
  eventCount?: number;
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

export interface ApixConfig {
  heartbeatInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  messageQueueSize: number;
  compressionThreshold: number;
  rateLimits: {
    eventsPerSecond: number;
    eventsPerMinute: number;
    connectionsPerUser: number;
  };
  channels: Record<string, ApixChannelConfig>;
}

export interface ApixChannelConfig {
  requiresAuth: boolean;
  permissions: string[];
  rateLimit?: {
    limit: number;
    window: number;
  };
  maxSubscribers?: number;
  retentionPeriod?: number;
}

export interface ApixQueuedMessage {
  event: ApixEvent;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  createdAt: Date;
}

export interface ApixStreamChunk {
  streamId: string;
  chunkIndex: number;
  totalChunks: number;
  data: any;
  isComplete: boolean;
  timestamp: Date;
}

export type ApixChannel = 
  | 'agent-events'
  | 'tool-events'
  | 'workflow-events'
  | 'provider-events'
  | 'system-events'
  | 'user-events'
  | 'organization-events'
  | 'streaming'
  | 'custom';

export const APIX_CHANNELS = {
  AGENT_EVENTS: 'agent-events' as ApixChannel,
  TOOL_EVENTS: 'tool-events' as ApixChannel,
  WORKFLOW_EVENTS: 'workflow-events' as ApixChannel,
  PROVIDER_EVENTS: 'provider-events' as ApixChannel,
  SYSTEM_EVENTS: 'system-events' as ApixChannel,
  USER_EVENTS: 'user-events' as ApixChannel,
  ORGANIZATION_EVENTS: 'organization-events' as ApixChannel,
  STREAMING: 'streaming' as ApixChannel,
  CUSTOM: 'custom' as ApixChannel,
} as const;

export type ApixEventType = 
  // Agent Events
  | 'AGENT_CREATED'
  | 'AGENT_UPDATED'
  | 'AGENT_DELETED'
  | 'AGENT_STARTED'
  | 'AGENT_STOPPED'
  | 'AGENT_MESSAGE'
  | 'AGENT_ERROR'
  | 'AGENT_STREAM_START'
  | 'AGENT_STREAM_CHUNK'
  | 'AGENT_STREAM_END'
  // Tool Events
  | 'TOOL_CREATED'
  | 'TOOL_UPDATED'
  | 'TOOL_DELETED'
  | 'TOOL_EXECUTED'
  | 'TOOL_ERROR'
  | 'TOOL_STREAM_START'
  | 'TOOL_STREAM_CHUNK'
  | 'TOOL_STREAM_END'
  // Workflow Events
  | 'WORKFLOW_CREATED'
  | 'WORKFLOW_UPDATED'
  | 'WORKFLOW_DELETED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'
  | 'WORKFLOW_PAUSED'
  | 'WORKFLOW_RESUMED'
  | 'WORKFLOW_NODE_EXECUTED'
  | 'WORKFLOW_NODE_FAILED'
  // Provider Events
  | 'PROVIDER_CONNECTED'
  | 'PROVIDER_DISCONNECTED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_FALLBACK'
  // System Events
  | 'SYSTEM_STARTUP'
  | 'SYSTEM_SHUTDOWN'
  | 'SYSTEM_ERROR'
  | 'SYSTEM_HEALTH_CHECK'
  | 'SYSTEM_MAINTENANCE'
  // User Events
  | 'USER_CONNECTED'
  | 'USER_DISCONNECTED'
  | 'USER_ACTION'
  // Organization Events
  | 'ORG_CREATED'
  | 'ORG_UPDATED'
  | 'ORG_DELETED'
  | 'ORG_USER_ADDED'
  | 'ORG_USER_REMOVED'
  // Custom Events
  | 'CUSTOM_EVENT'
  | 'BROADCAST'
  | 'STREAM_DATA';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface ConnectionOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
  compressionThreshold?: number;
}

export interface SubscriptionOptions {
  channel?: ApixChannel;
  eventType?: ApixEventType;
  filters?: Record<string, any>;
  includeHistory?: boolean;
  historyLimit?: number;
}

export type EventHandler<T extends ApixEvent = ApixEvent> = (event: T) => void;

export interface ApixClientInterface {
  connect(token?: string, organizationId?: string): Promise<void>;
  disconnect(): void;
  subscribe<T extends ApixEvent>(handler: EventHandler<T>, options?: SubscriptionOptions): () => void;
  publish<T extends ApixEvent>(event: Partial<T> & { type: T['type']; channel: T['channel'] }): string;
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(roomId: string): Promise<void>;
  getStatus(): ConnectionStatus;
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void;
  getMetrics(): ApixMetrics | null;
  getEventHistory(channel?: ApixChannel, limit?: number): ApixEvent[];
}