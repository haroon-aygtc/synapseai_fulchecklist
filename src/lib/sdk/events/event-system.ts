import { ApixClient } from '../../apix/client';
import { ApixEvent, ApixChannel, ApixEventType } from '../../apix/types';

export interface SDKEvent extends Omit<ApixEvent, 'metadata'> {
  metadata: {
    timestamp: Date;
    source: string;
    componentId?: string;
    userId?: string;
    organizationId?: string;
    sessionId?: string;
    version?: string;
    correlationId?: string;
    parentEventId?: string;
  };
}

export interface EventSubscription {
  id: string;
  eventType: string;
  channel: ApixChannel;
  handler: (event: SDKEvent) => void;
  filters?: Record<string, any>;
  isActive: boolean;
}

export interface EventSystemConfig {
  apiUrl: string;
  apiKey: string;
  tenantId: string;
  componentId?: string;
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export class SDKEventSystem {
  private apixClient: ApixClient;
  private subscriptions = new Map<string, EventSubscription>();
  private eventQueue: SDKEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private config: EventSystemConfig;
  private componentId: string;

  constructor(config: EventSystemConfig) {
    this.config = {
      enableBatching: true,
      batchSize: 10,
      batchTimeout: 1000,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.componentId = config.componentId || `sdk-component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.apixClient = new ApixClient({
      url: config.apiUrl,
      apiKey: config.apiKey,
      tenantId: config.tenantId
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.apixClient.connect();
      this.setupGlobalEventHandlers();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize SDK Event System: ${error.message}`);
    }
  }

  async destroy(): Promise<void> {
    if (!this.isInitialized) return;

    // Clear all subscriptions
    this.subscriptions.clear();
    
    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush remaining events
    if (this.eventQueue.length > 0) {
      await this.flushEventQueue();
    }

    // Disconnect APIX client
    this.apixClient.disconnect();
    this.isInitialized = false;
  }

  // Event subscription methods
  subscribe<T extends SDKEvent = SDKEvent>(
    eventType: string,
    handler: (event: T) => void,
    options?: {
      channel?: ApixChannel;
      filters?: Record<string, any>;
      once?: boolean;
    }
  ): () => void {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const channel = options?.channel || 'custom';

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      channel,
      handler: options?.once ? this.createOnceHandler(handler, subscriptionId) : handler,
      filters: options?.filters,
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Subscribe to APIX events
    const unsubscribeApix = this.apixClient.subscribe(
      (apixEvent: ApixEvent) => {
        if (this.shouldHandleEvent(apixEvent, subscription)) {
          const sdkEvent = this.transformApixEventToSDKEvent(apixEvent);
          handler(sdkEvent as T);
        }
      },
      {
        channel,
        eventType: eventType as ApixEventType,
        filters: options?.filters
      }
    );

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscriptionId);
      unsubscribeApix();
    };
  }

  subscribeToComponent(
    componentId: string,
    eventType: string,
    handler: (event: SDKEvent) => void
  ): () => void {
    return this.subscribe(eventType, handler, {
      filters: { componentId }
    });
  }

  subscribeToChannel(
    channel: ApixChannel,
    handler: (event: SDKEvent) => void,
    filters?: Record<string, any>
  ): () => void {
    return this.subscribe('*', handler, { channel, filters });
  }

  // Event publishing methods
  async publish(event: Partial<SDKEvent> & { type: string }): Promise<string> {
    const sdkEvent: SDKEvent = {
      id: event.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: event.type,
      channel: event.channel || 'custom',
      data: event.data || {},
      metadata: {
        timestamp: new Date(),
        source: this.componentId,
        componentId: this.componentId,
        ...event.metadata
      },
      priority: event.priority || 'normal'
    };

    if (this.config.enableBatching) {
      this.addToQueue(sdkEvent);
    } else {
      await this.publishSingle(sdkEvent);
    }

    return sdkEvent.id;
  }

  async publishToComponent(
    targetComponentId: string,
    eventType: string,
    data: any,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    return this.publish({
      type: eventType,
      data,
      priority: options?.priority,
      metadata: {
        targetComponentId,
        ...options?.metadata
      }
    });
  }

  async broadcast(
    eventType: string,
    data: any,
    options?: {
      channel?: ApixChannel;
      filters?: Record<string, any>;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }
  ): Promise<string> {
    return this.publish({
      type: eventType,
      channel: options?.channel || 'custom',
      data,
      priority: options?.priority,
      metadata: {
        broadcast: true,
        filters: options?.filters
      }
    });
  }

  // Agent collaboration events
  async publishAgentCollaborationEvent(
    eventType: 'COLLABORATION_REQUEST' | 'COLLABORATION_RESPONSE' | 'COLLABORATION_MESSAGE' | 'COLLABORATION_END',
    data: {
      fromAgentId: string;
      toAgentId?: string;
      collaborationId?: string;
      message?: string;
      context?: any;
      metadata?: any;
    }
  ): Promise<string> {
    return this.publish({
      type: eventType,
      channel: 'agent-events',
      data,
      priority: 'high',
      metadata: {
        agentCollaboration: true,
        fromAgentId: data.fromAgentId,
        toAgentId: data.toAgentId,
        collaborationId: data.collaborationId
      }
    });
  }

  // Tool execution events
  async publishToolExecutionEvent(
    eventType: 'TOOL_EXECUTION_START' | 'TOOL_EXECUTION_PROGRESS' | 'TOOL_EXECUTION_COMPLETE' | 'TOOL_EXECUTION_ERROR',
    data: {
      toolId: string;
      executionId: string;
      agentId?: string;
      workflowId?: string;
      input?: any;
      output?: any;
      error?: string;
      progress?: number;
      metadata?: any;
    }
  ): Promise<string> {
    return this.publish({
      type: eventType,
      channel: 'tool-events',
      data,
      priority: eventType.includes('ERROR') ? 'high' : 'normal',
      metadata: {
        toolExecution: true,
        toolId: data.toolId,
        executionId: data.executionId,
        agentId: data.agentId,
        workflowId: data.workflowId
      }
    });
  }

  // Workflow events
  async publishWorkflowEvent(
    eventType: 'WORKFLOW_NODE_EXECUTED' | 'WORKFLOW_PROGRESS' | 'WORKFLOW_STATE_CHANGE',
    data: {
      workflowId: string;
      nodeId?: string;
      executionId: string;
      state?: string;
      progress?: number;
      result?: any;
      error?: string;
      metadata?: any;
    }
  ): Promise<string> {
    return this.publish({
      type: eventType,
      channel: 'workflow-events',
      data,
      priority: 'normal',
      metadata: {
        workflowExecution: true,
        workflowId: data.workflowId,
        nodeId: data.nodeId,
        executionId: data.executionId
      }
    });
  }

  // Component lifecycle events
  async publishComponentEvent(
    eventType: 'COMPONENT_MOUNTED' | 'COMPONENT_UNMOUNTED' | 'COMPONENT_ERROR' | 'COMPONENT_STATE_CHANGE',
    data: {
      componentType: string;
      componentProps?: any;
      state?: any;
      error?: string;
      metadata?: any;
    }
  ): Promise<string> {
    return this.publish({
      type: eventType,
      channel: 'custom',
      data,
      metadata: {
        componentLifecycle: true,
        componentType: data.componentType,
        componentId: this.componentId
      }
    });
  }

  // Event history and replay
  getEventHistory(
    filters?: {
      eventType?: string;
      channel?: ApixChannel;
      componentId?: string;
      timeRange?: { start: Date; end: Date };
      limit?: number;
    }
  ): SDKEvent[] {
    return this.apixClient.getEventHistory(filters?.channel, filters?.limit)
      .map(event => this.transformApixEventToSDKEvent(event))
      .filter(event => {
        if (filters?.eventType && event.type !== filters.eventType) return false;
        if (filters?.componentId && event.metadata.componentId !== filters.componentId) return false;
        if (filters?.timeRange) {
          const eventTime = event.metadata.timestamp;
          if (eventTime < filters.timeRange.start || eventTime > filters.timeRange.end) return false;
        }
        return true;
      });
  }

  async replayEvents(
    events: SDKEvent[],
    options?: {
      delay?: number;
      skipErrors?: boolean;
    }
  ): Promise<void> {
    const delay = options?.delay || 100;
    
    for (const event of events) {
      try {
        await this.publishSingle(event);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        if (!options?.skipErrors) {
          throw error;
        }
      }
    }
  }

  // Utility methods
  getActiveSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  isConnected(): boolean {
    return this.isInitialized && this.apixClient.getStatus() === 'connected';
  }

  getConnectionStatus(): string {
    return this.apixClient.getStatus();
  }

  // Private methods
  private setupGlobalEventHandlers(): void {
    // Handle connection status changes
    this.apixClient.onStatusChange((status) => {
      this.publish({
        type: 'SDK_CONNECTION_STATUS_CHANGE',
        data: { status, componentId: this.componentId }
      });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.publish({
        type: 'SDK_GLOBAL_ERROR',
        data: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error?.toString()
        },
        priority: 'high'
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.publish({
        type: 'SDK_UNHANDLED_REJECTION',
        data: {
          reason: event.reason?.toString(),
          promise: event.promise?.toString()
        },
        priority: 'high'
      });
    });
  }

  private shouldHandleEvent(apixEvent: ApixEvent, subscription: EventSubscription): boolean {
    // Check event type
    if (subscription.eventType !== '*' && apixEvent.type !== subscription.eventType) {
      return false;
    }

    // Check channel
    if (apixEvent.channel !== subscription.channel) {
      return false;
    }

    // Check filters
    if (subscription.filters) {
      for (const [key, value] of Object.entries(subscription.filters)) {
        if (apixEvent.data[key] !== value && apixEvent.metadata[key] !== value) {
          return false;
        }
      }
    }

    return subscription.isActive;
  }

  private transformApixEventToSDKEvent(apixEvent: ApixEvent): SDKEvent {
    return {
      ...apixEvent,
      metadata: {
        timestamp: apixEvent.metadata.timestamp,
        source: apixEvent.metadata.source,
        componentId: apixEvent.metadata.componentId,
        userId: apixEvent.metadata.userId,
        organizationId: apixEvent.metadata.organizationId,
        sessionId: apixEvent.metadata.sessionId,
        version: apixEvent.metadata.version,
        correlationId: apixEvent.metadata.correlationId,
        parentEventId: apixEvent.metadata.parentEventId
      }
    };
  }

  private createOnceHandler<T extends SDKEvent>(
    handler: (event: T) => void,
    subscriptionId: string
  ): (event: T) => void {
    return (event: T) => {
      handler(event);
      this.subscriptions.delete(subscriptionId);
    };
  }

  private addToQueue(event: SDKEvent): void {
    this.eventQueue.push(event);

    if (this.eventQueue.length >= (this.config.batchSize || 10)) {
      this.flushEventQueue();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushEventQueue();
      }, this.config.batchTimeout || 1000);
    }
  }

  private async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await this.publishBatch(events);
    } catch (error) {
      // Re-queue events if batch fails and retry is enabled
      if (this.config.enableRetry) {
        this.eventQueue.unshift(...events);
        setTimeout(() => this.flushEventQueue(), this.config.retryDelay || 1000);
      }
    }
  }

  private async publishSingle(event: SDKEvent): Promise<void> {
    const apixEvent: Partial<ApixEvent> = {
      type: event.type as ApixEventType,
      channel: event.channel,
      data: event.data,
      metadata: {
        timestamp: event.metadata.timestamp,
        source: event.metadata.source,
        componentId: event.metadata.componentId,
        userId: event.metadata.userId,
        organizationId: event.metadata.organizationId,
        sessionId: event.metadata.sessionId,
        version: event.metadata.version,
        correlationId: event.metadata.correlationId,
        parentEventId: event.metadata.parentEventId
      },
      priority: event.priority
    };

    this.apixClient.publish(apixEvent);
  }

  private async publishBatch(events: SDKEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishSingle(event);
    }
  }
}

// Global event system instance
let globalEventSystem: SDKEventSystem | null = null;

export function initializeGlobalEventSystem(config: EventSystemConfig): SDKEventSystem {
  if (globalEventSystem) {
    globalEventSystem.destroy();
  }
  
  globalEventSystem = new SDKEventSystem(config);
  return globalEventSystem;
}

export function getGlobalEventSystem(): SDKEventSystem | null {
  return globalEventSystem;
}

export function destroyGlobalEventSystem(): void {
  if (globalEventSystem) {
    globalEventSystem.destroy();
    globalEventSystem = null;
  }
}