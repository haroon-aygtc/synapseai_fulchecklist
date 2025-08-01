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
    version: string;
  };
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface ApixSubscription {
  id: string;
  channel: string;
  userId: string;
  organizationId: string;
  filters?: Record<string, any>;
  callback: (event: ApixEvent) => void;
  isActive: boolean;
  createdAt: Date;
  lastEventAt?: Date;
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
  };
}

export interface ApixRoom {
  id: string;
  name: string;
  organizationId: string;
  participants: string[];
  settings: {
    maxParticipants: number;
    isPrivate: boolean;
    requiresAuth: boolean;
    messageRetention: number;
  };
  createdAt: Date;
  lastActivityAt: Date;
}

export interface ApixMessage {
  id: string;
  roomId: string;
  fromUserId: string;
  type: 'text' | 'event' | 'system' | 'binary';
  content: any;
  metadata: Record<string, any>;
  timestamp: Date;
  deliveredTo: string[];
  readBy: string[];
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
  channels: {
    [key: string]: {
      requiresAuth: boolean;
      permissions: string[];
      rateLimits?: {
        eventsPerSecond: number;
        eventsPerMinute: number;
      };
    };
  };
}

export const APIX_CHANNELS = {
  AGENT_EVENTS: 'agent-events',
  TOOL_EVENTS: 'tool-events',
  WORKFLOW_EVENTS: 'workflow-events',
  PROVIDER_EVENTS: 'provider-events',
  SYSTEM_EVENTS: 'system-events',
  USER_EVENTS: 'user-events',
  ORGANIZATION_EVENTS: 'organization-events'
} as const;

export type ApixChannel = typeof APIX_CHANNELS[keyof typeof APIX_CHANNELS];

export const APIX_EVENT_TYPES = {
  // Agent Events
  AGENT_CREATED: 'AGENT_CREATED',
  AGENT_UPDATED: 'AGENT_UPDATED',
  AGENT_DELETED: 'AGENT_DELETED',
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_STOPPED: 'SESSION_STOPPED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_FAILED: 'TASK_FAILED',
  AGENT_JOINED_ROOM: 'AGENT_JOINED_ROOM',
  AGENT_LEFT_ROOM: 'AGENT_LEFT_ROOM',
  
  // Tool Events
  TOOL_CREATED: 'TOOL_CREATED',
  TOOL_UPDATED: 'TOOL_UPDATED',
  TOOL_DELETED: 'TOOL_DELETED',
  TOOL_EXECUTED: 'TOOL_EXECUTED',
  TOOL_ERROR: 'TOOL_ERROR',
  
  // Workflow Events
  WORKFLOW_CREATED: 'WORKFLOW_CREATED',
  WORKFLOW_UPDATED: 'WORKFLOW_UPDATED',
  WORKFLOW_DELETED: 'WORKFLOW_DELETED',
  WORKFLOW_STARTED: 'WORKFLOW_STARTED',
  WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  WORKFLOW_PAUSED: 'WORKFLOW_PAUSED',
  WORKFLOW_RESUMED: 'WORKFLOW_RESUMED',
  
  // Provider Events
  PROVIDER_CONNECTED: 'PROVIDER_CONNECTED',
  PROVIDER_DISCONNECTED: 'PROVIDER_DISCONNECTED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  
  // System Events
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  SYSTEM_UPDATE: 'SYSTEM_UPDATE',
  
  // User Events
  USER_CONNECTED: 'USER_CONNECTED',
  USER_DISCONNECTED: 'USER_DISCONNECTED',
  USER_ACTIVITY: 'USER_ACTIVITY',
  
  // Organization Events
  ORG_SETTINGS_UPDATED: 'ORG_SETTINGS_UPDATED',
  ORG_USER_ADDED: 'ORG_USER_ADDED',
  ORG_USER_REMOVED: 'ORG_USER_REMOVED'
} as const;

export type ApixEventType = typeof APIX_EVENT_TYPES[keyof typeof APIX_EVENT_TYPES];