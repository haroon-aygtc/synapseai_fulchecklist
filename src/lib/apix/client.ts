import { io, Socket } from 'socket.io-client';
import { 
  ApixEvent, 
  ApixSubscription, 
  ApixConnection, 
  ApixChannel, 
  ApixEventType,
  ApixConfig,
  APIX_CHANNELS,
  ConnectionStatus,
  ConnectionOptions,
  SubscriptionOptions,
  EventHandler,
  ApixClientInterface,
  ApixMetrics,
  ApixQueuedMessage
} from './types';

class ApixClient implements ApixClientInterface {
  private socket: Socket | null = null;
  private subscriptions: Map<string, ApixSubscription> = new Map();
  private messageQueue: ApixQueuedMessage[] = [];
  private status: ConnectionStatus = 'disconnected';
  private statusCallbacks: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectAttempts = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: ApixConfig;
  private latencyScores: number[] = [];
  private eventBuffer: ApixEvent[] = [];
  private currentToken: string | null = null;
  private currentOrganizationId: string | null = null;
  private metrics: ApixMetrics | null = null;
  private streamBuffers: Map<string, ApixEvent[]> = new Map();

  constructor(options?: ConnectionOptions) {
    this.config = {
      heartbeatInterval: options?.heartbeatInterval || 30000,
      reconnectInterval: options?.reconnectInterval || 5000,
      maxReconnectAttempts: options?.maxReconnectAttempts || 10,
      messageQueueSize: options?.messageQueueSize || 1000,
      compressionThreshold: options?.compressionThreshold || 1024,
      rateLimits: {
        eventsPerSecond: 100,
        eventsPerMinute: 1000,
        connectionsPerUser: 5
      },
      channels: {
        [APIX_CHANNELS.AGENT_EVENTS]: {
          requiresAuth: true,
          permissions: ['AGENT_READ']
        },
        [APIX_CHANNELS.TOOL_EVENTS]: {
          requiresAuth: true,
          permissions: ['TOOL_READ']
        },
        [APIX_CHANNELS.WORKFLOW_EVENTS]: {
          requiresAuth: true,
          permissions: ['WORKFLOW_READ']
        },
        [APIX_CHANNELS.PROVIDER_EVENTS]: {
          requiresAuth: true,
          permissions: ['SYSTEM_ADMIN']
        },
        [APIX_CHANNELS.SYSTEM_EVENTS]: {
          requiresAuth: true,
          permissions: ['SYSTEM_ADMIN']
        },
        [APIX_CHANNELS.USER_EVENTS]: {
          requiresAuth: true,
          permissions: ['USER_MANAGE']
        },
        [APIX_CHANNELS.ORGANIZATION_EVENTS]: {
          requiresAuth: true,
          permissions: ['ORG_MANAGE']
        },
        [APIX_CHANNELS.STREAMING]: {
          requiresAuth: true,
          permissions: ['STREAM_READ']
        },
        [APIX_CHANNELS.CUSTOM]: {
          requiresAuth: false,
          permissions: []
        }
      }
    };
  }

  async connect(token?: string, organizationId?: string): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    // Use provided credentials or stored ones
    const authToken = token || this.currentToken;
    const orgId = organizationId || this.currentOrganizationId;

    if (!authToken) {
      throw new Error('Authentication token is required');
    }

    this.currentToken = authToken;
    this.currentOrganizationId = orgId;
    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(process.env.NEXT_PUBLIC_APIX_URL || 'ws://localhost:3001/apix', {
          auth: {
            token: authToken,
            organizationId: orgId
          },
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: true,
          timeout: 20000,
          forceNew: false,
          reconnection: true,
          reconnectionAttempts: this.config.maxReconnectAttempts,
          reconnectionDelay: this.config.reconnectInterval,
          reconnectionDelayMax: 30000,
          maxHttpBufferSize: 1e6,
          pingTimeout: 60000,
          pingInterval: 25000
        });

        this.setupEventHandlers();

        this.socket.on('connect', () => {
          // APIX connection established
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          this.resubscribeAll();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('APIX connection error:', error);
          this.setStatus('error');
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          // APIX connection closed
          this.setStatus('disconnected');
          this.stopHeartbeat();
          
          if (reason === 'io server disconnect') {
            this.reconnect();
          }
        });

      } catch (error) {
        this.setStatus('error');
        reject(error);
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Handle incoming events
    this.socket.on('event', (event: ApixEvent) => {
      this.handleIncomingEvent(event);
    });

    // Handle streaming responses
    this.socket.on('stream', (data: any) => {
      this.handleStreamingData(data);
    });

    // Handle stream chunks
    this.socket.on('stream_chunk', (chunk: any) => {
      this.handleStreamChunk(chunk);
    });

    // Handle latency measurements
    this.socket.on('pong', (timestamp: number) => {
      const latency = Date.now() - timestamp;
      this.updateLatencyScore(latency);
    });

    // Handle room events
    this.socket.on('room_joined', (roomId: string) => {
      // Joined room successfully
    });

    this.socket.on('room_left', (roomId: string) => {
      // Left room successfully
    });

    // Handle connection events
    this.socket.on('connected', (data: any) => {
      // Connection established with server
    });

    // Handle subscription confirmations
    this.socket.on('subscribed', (data: { subscriptionId: string }) => {
      // Subscription confirmed
    });

    this.socket.on('unsubscribed', (data: { subscriptionId: string }) => {
      // Unsubscription confirmed
    });

    // Handle errors
    this.socket.on('error', (error: any) => {
      console.error('APIX error:', error);
    });

    // Handle rate limiting
    this.socket.on('rate_limited', (info: any) => {
      console.warn('Rate limited:', info);
    });

    // Handle metrics updates
    this.socket.on('metrics', (metrics: ApixMetrics) => {
      this.metrics = metrics;
    });
  }

  private handleIncomingEvent(event: ApixEvent): void {
    // Ensure timestamp is a Date object
    if (typeof event.metadata.timestamp === 'string') {
      event.metadata.timestamp = new Date(event.metadata.timestamp);
    }

    // Handle streaming events
    if (event.streamId) {
      this.handleStreamEvent(event);
      return;
    }

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.channel === event.channel && sub.isActive);

    // Apply filters and call callbacks
    for (const subscription of matchingSubscriptions) {
      if (this.eventMatchesFilters(event, subscription.filters)) {
        try {
          subscription.callback(event);
          subscription.lastEventAt = new Date();
          subscription.eventCount = (subscription.eventCount || 0) + 1;
        } catch (error) {
          console.error('Error in subscription callback:', error);
        }
      }
    }

    // Buffer events for replay
    this.bufferEvent(event);
  }

  private handleStreamEvent(event: ApixEvent): void {
    if (!event.streamId) return;

    // Get or create stream buffer
    let streamBuffer = this.streamBuffers.get(event.streamId);
    if (!streamBuffer) {
      streamBuffer = [];
      this.streamBuffers.set(event.streamId, streamBuffer);
    }

    // Add chunk to buffer
    streamBuffer.push(event);

    // If this is the end of the stream, process it
    if (event.isStreamEnd || (event.chunkIndex !== undefined && event.totalChunks !== undefined && event.chunkIndex === event.totalChunks - 1)) {
      this.processStreamBuffer(event.streamId, streamBuffer);
      this.streamBuffers.delete(event.streamId);
    }

    // Also handle individual chunks
    this.handleIncomingEvent(event);
  }

  private processStreamBuffer(streamId: string, chunks: ApixEvent[]): void {
    // Sort chunks by index if available
    if (chunks.length > 0 && chunks[0].chunkIndex !== undefined) {
      chunks.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
    }

    // Combine data from all chunks
    const combinedData = chunks.map(chunk => chunk.data);

    // Create a combined event
    const combinedEvent: ApixEvent = {
      ...chunks[0],
      id: `stream_combined_${streamId}`,
      type: 'STREAM_COMPLETED',
      data: combinedData,
      metadata: {
        ...chunks[0].metadata,
        timestamp: new Date(),
        streamId,
        totalChunks: chunks.length
      }
    };

    // Handle the combined event
    this.handleIncomingEvent(combinedEvent);
  }

  private handleStreamingData(data: any): void {
    const event: ApixEvent = {
      id: `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'STREAM_DATA',
      channel: 'streaming',
      data,
      metadata: {
        timestamp: new Date(),
        source: 'apix-client',
        version: '1.0.0'
      },
      priority: 'normal'
    };

    this.handleIncomingEvent(event);
  }

  private handleStreamChunk(chunk: any): void {
    const event: ApixEvent = {
      id: `chunk_${chunk.streamId}_${chunk.chunkIndex}`,
      type: 'STREAM_CHUNK',
      channel: 'streaming',
      data: chunk.data,
      metadata: {
        timestamp: new Date(),
        source: 'apix-client',
        version: '1.0.0'
      },
      priority: 'normal',
      streamId: chunk.streamId,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      isStreamEnd: chunk.isComplete
    };

    this.handleIncomingEvent(event);
  }

  private eventMatchesFilters(event: ApixEvent, filters?: Record<string, any>): boolean {
    if (!filters) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (key === 'type' && event.type !== value) return false;
      if (key === 'eventType' && event.type !== value) return false;
      if (key === 'userId' && event.metadata.userId !== value) return false;
      if (key === 'organizationId' && event.metadata.organizationId !== value) return false;
      if (key === 'sessionId' && event.metadata.sessionId !== value) return false;
      if (key === 'priority' && event.priority !== value) return false;
      
      // Support nested property filtering
      if (key.includes('.')) {
        const keys = key.split('.');
        let obj: any = event;
        for (const k of keys) {
          obj = obj?.[k];
        }
        if (obj !== value) return false;
      }
    }

    return true;
  }

  private bufferEvent(event: ApixEvent): void {
    this.eventBuffer.push(event);
    
    // Keep only the last 1000 events
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer = this.eventBuffer.slice(-1000);
    }
  }

  subscribe<T extends ApixEvent>(
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): () => void {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: ApixSubscription = {
      id: subscriptionId,
      channel: options.channel || APIX_CHANNELS.CUSTOM,
      userId: '', // Would be set from auth context
      organizationId: this.currentOrganizationId || '',
      filters: options.filters,
      callback: handler as (event: ApixEvent) => void,
      isActive: true,
      createdAt: new Date(),
      eventCount: 0
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Subscribe on server if connected
    if (this.socket?.connected) {
      this.socket.emit('subscribe', {
        subscriptionId,
        channel: subscription.channel,
        filters: subscription.filters
      });
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(subscriptionId);
    };
  }

  private async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.isActive = false;
    this.subscriptions.delete(subscriptionId);

    // Unsubscribe on server if connected
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', { subscriptionId });
    }
  }

  publish<T extends ApixEvent>(
    event: Partial<T> & { type: T['type']; channel: T['channel'] }
  ): string {
    const fullEvent: ApixEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: event.type,
      channel: event.channel,
      data: event.data || {},
      metadata: {
        timestamp: new Date(),
        userId: event.metadata?.userId,
        organizationId: this.currentOrganizationId || '',
        sessionId: event.metadata?.sessionId,
        source: 'apix-client',
        version: '1.0.0',
        ...event.metadata
      },
      priority: event.priority || 'normal',
      ttl: event.ttl,
      retryCount: event.retryCount || 0,
      maxRetries: event.maxRetries || 3
    };

    if (this.socket?.connected) {
      this.socket.emit('event', fullEvent);
    } else {
      // Queue message for later delivery
      this.queueMessage(fullEvent);
    }

    return fullEvent.id;
  }

  async joinRoom(roomId: string): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Not connected to APIX server');
    }

    this.socket.emit('join_room', { roomId });
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Not connected to APIX server');
    }

    this.socket.emit('leave_room', { roomId });
  }

  private queueMessage(event: ApixEvent): void {
    const queuedMessage: ApixQueuedMessage = {
      event,
      attempts: 0,
      maxAttempts: event.maxRetries || 3,
      nextRetryAt: new Date(),
      createdAt: new Date()
    };

    this.messageQueue.push(queuedMessage);
    
    // Limit queue size
    if (this.messageQueue.length > this.config.messageQueueSize) {
      this.messageQueue = this.messageQueue.slice(-this.config.messageQueueSize);
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (!this.socket?.connected || this.messageQueue.length === 0) {
      return;
    }

    const now = new Date();
    const messagesToProcess = this.messageQueue.filter(msg => msg.nextRetryAt <= now);
    
    for (const queuedMessage of messagesToProcess) {
      try {
        this.socket.emit('event', queuedMessage.event);
        
        // Remove from queue on success
        const index = this.messageQueue.indexOf(queuedMessage);
        if (index > -1) {
          this.messageQueue.splice(index, 1);
        }
      } catch (error) {
        console.error('Error processing queued message:', error);
        
        queuedMessage.attempts++;
        
        if (queuedMessage.attempts >= queuedMessage.maxAttempts) {
          // Remove failed message
          const index = this.messageQueue.indexOf(queuedMessage);
          if (index > -1) {
            this.messageQueue.splice(index, 1);
          }
        } else {
          // Schedule retry with exponential backoff
          queuedMessage.nextRetryAt = new Date(now.getTime() + Math.pow(2, queuedMessage.attempts) * 1000);
        }
      }
    }
  }

  private resubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isActive && this.socket?.connected) {
        this.socket.emit('subscribe', {
          subscriptionId: subscription.id,
          channel: subscription.channel,
          filters: subscription.filters
        });
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        const timestamp = Date.now();
        this.socket.emit('ping', timestamp);
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private updateLatencyScore(latency: number): void {
    this.latencyScores.push(latency);
    
    // Keep only the last 100 measurements
    if (this.latencyScores.length > 100) {
      this.latencyScores = this.latencyScores.slice(-100);
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.setStatus('error');
      return;
    }

    this.reconnectAttempts++;
    this.setStatus('reconnecting');
    
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (!this.socket?.connected && this.currentToken) {
        // Attempting reconnection
        this.connect(this.currentToken, this.currentOrganizationId).catch(console.error);
      }
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusCallbacks.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in status callback:', error);
        }
      });
    }
  }

  // Public utility methods
  getStatus(): ConnectionStatus {
    return this.status;
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  getLatencyScore(): number {
    if (this.latencyScores.length === 0) return 0;
    return this.latencyScores.reduce((a, b) => a + b, 0) / this.latencyScores.length;
  }

  isConnectedToServer(): boolean {
    return this.status === 'connected' && this.socket?.connected === true;
  }

  getConnectionInfo(): any {
    return {
      status: this.status,
      isConnected: this.isConnectedToServer(),
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      queuedMessages: this.messageQueue.length,
      averageLatency: this.getLatencyScore(),
      socketId: this.socket?.id,
      organizationId: this.currentOrganizationId
    };
  }

  getEventHistory(channel?: ApixChannel, limit: number = 100): ApixEvent[] {
    let events = this.eventBuffer;
    
    if (channel) {
      events = events.filter(event => event.channel === channel);
    }
    
    return events.slice(-limit);
  }

  getMetrics(): ApixMetrics | null {
    return this.metrics;
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    
    // Clear all subscriptions
    for (const subscriptionId of this.subscriptions.keys()) {
      await this.unsubscribe(subscriptionId);
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.setStatus('disconnected');
    this.messageQueue = [];
    this.eventBuffer = [];
    this.latencyScores = [];
    this.streamBuffers.clear();
    this.metrics = null;
    this.reconnectAttempts = 0;
  }
}

export const apixClient = new ApixClient();
export { ApixClient };