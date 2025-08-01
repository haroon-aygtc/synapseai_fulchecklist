import { io, Socket } from 'socket.io-client';
import { 
  ApixEvent, 
  ApixSubscription, 
  ApixConnection, 
  ApixChannel, 
  ApixEventType,
  ApixConfig,
  APIX_CHANNELS 
} from './types';

class ApixClient {
  private socket: Socket | null = null;
  private subscriptions: Map<string, ApixSubscription> = new Map();
  private messageQueue: ApixEvent[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: ApixConfig;
  private latencyScores: number[] = [];
  private eventBuffer: ApixEvent[] = [];

  constructor() {
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      reconnectInterval: 5000, // 5 seconds
      maxReconnectAttempts: 10,
      messageQueueSize: 1000,
      compressionThreshold: 1024, // 1KB
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
        }
      }
    };
  }

  async connect(token: string, organizationId: string): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(process.env.NEXT_PUBLIC_APIX_URL || 'ws://localhost:3001', {
          auth: {
            token,
            organizationId
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
          maxHttpBufferSize: 1e6, // 1MB
          pingTimeout: 60000,
          pingInterval: 25000
        });

        this.setupEventHandlers();

        this.socket.on('connect', () => {
          console.log('APIX connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('APIX connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('APIX disconnected:', reason);
          this.isConnected = false;
          this.stopHeartbeat();
          
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, try to reconnect
            this.reconnect();
          }
        });

      } catch (error) {
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

    // Handle latency measurements
    this.socket.on('pong', (timestamp: number) => {
      const latency = Date.now() - timestamp;
      this.updateLatencyScore(latency);
    });

    // Handle room events
    this.socket.on('room_joined', (roomId: string) => {
      console.log(`Joined room: ${roomId}`);
    });

    this.socket.on('room_left', (roomId: string) => {
      console.log(`Left room: ${roomId}`);
    });

    // Handle errors
    this.socket.on('error', (error: any) => {
      console.error('APIX error:', error);
    });

    // Handle rate limiting
    this.socket.on('rate_limited', (info: any) => {
      console.warn('Rate limited:', info);
    });
  }

  private handleIncomingEvent(event: ApixEvent): void {
    // Update event metadata
    event.metadata.timestamp = new Date(event.metadata.timestamp);

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.channel === event.channel && sub.isActive);

    // Apply filters and call callbacks
    for (const subscription of matchingSubscriptions) {
      if (this.eventMatchesFilters(event, subscription.filters)) {
        try {
          subscription.callback(event);
          subscription.lastEventAt = new Date();
        } catch (error) {
          console.error('Error in subscription callback:', error);
        }
      }
    }

    // Buffer events for replay
    this.bufferEvent(event);
  }

  private handleStreamingData(data: any): void {
    // Handle streaming responses from agents/tools
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

  private eventMatchesFilters(event: ApixEvent, filters?: Record<string, any>): boolean {
    if (!filters) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (key === 'type' && event.type !== value) return false;
      if (key === 'userId' && event.metadata.userId !== value) return false;
      if (key === 'organizationId' && event.metadata.organizationId !== value) return false;
      if (key === 'sessionId' && event.metadata.sessionId !== value) return false;
      
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

  async subscribe(
    channel: ApixChannel, 
    callback: (event: ApixEvent) => void,
    filters?: Record<string, any>
  ): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: ApixSubscription = {
      id: subscriptionId,
      channel,
      userId: '', // Would be set from auth context
      organizationId: '', // Would be set from auth context
      filters,
      callback,
      isActive: true,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Subscribe on server if connected
    if (this.socket?.connected) {
      this.socket.emit('subscribe', {
        subscriptionId,
        channel,
        filters
      });
    }

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.isActive = false;
    this.subscriptions.delete(subscriptionId);

    // Unsubscribe on server if connected
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', { subscriptionId });
    }
  }

  async emit(channel: ApixChannel, data: any, options?: {
    priority?: 'low' | 'normal' | 'high' | 'critical';
    ttl?: number;
    retryCount?: number;
    compress?: boolean;
  }): Promise<void> {
    const event: ApixEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type || 'CUSTOM_EVENT',
      channel,
      data,
      metadata: {
        timestamp: new Date(),
        userId: data.userId,
        organizationId: data.organizationId,
        sessionId: data.sessionId,
        source: 'apix-client',
        version: '1.0.0'
      },
      priority: options?.priority || 'normal',
      ttl: options?.ttl,
      retryCount: options?.retryCount || 0,
      maxRetries: 3
    };

    if (this.socket?.connected) {
      // Check if compression is needed
      const eventSize = JSON.stringify(event).length;
      const shouldCompress = options?.compress || eventSize > this.config.compressionThreshold;

      this.socket.emit('event', event, { compress: shouldCompress });
    } else {
      // Queue message for later delivery
      this.queueMessage(event);
    }
  }

  async broadcast(channel: ApixChannel, data: any, roomId?: string): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Not connected to APIX server');
    }

    const event: ApixEvent = {
      id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type || 'BROADCAST',
      channel,
      data,
      metadata: {
        timestamp: new Date(),
        source: 'apix-client',
        version: '1.0.0'
      },
      priority: 'normal'
    };

    this.socket.emit('broadcast', { event, roomId });
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
    this.messageQueue.push(event);
    
    // Limit queue size
    if (this.messageQueue.length > this.config.messageQueueSize) {
      this.messageQueue = this.messageQueue.slice(-this.config.messageQueueSize);
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (!this.socket?.connected || this.messageQueue.length === 0) {
      return;
    }

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        this.socket.emit('event', message);
      } catch (error) {
        console.error('Error processing queued message:', error);
        // Re-queue failed messages
        this.messageQueue.push(message);
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
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      if (!this.socket?.connected) {
        console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        this.socket?.connect();
      }
    }, this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1)); // Exponential backoff
  }

  // Utility methods
  getLatencyScore(): number {
    if (this.latencyScores.length === 0) return 0;
    return this.latencyScores.reduce((a, b) => a + b, 0) / this.latencyScores.length;
  }

  isConnectedToServer(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getConnectionInfo(): any {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      queuedMessages: this.messageQueue.length,
      averageLatency: this.getLatencyScore(),
      socketId: this.socket?.id
    };
  }

  getEventHistory(channel?: ApixChannel, limit: number = 100): ApixEvent[] {
    let events = this.eventBuffer;
    
    if (channel) {
      events = events.filter(event => event.channel === channel);
    }
    
    return events.slice(-limit);
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

    this.isConnected = false;
    this.messageQueue = [];
    this.eventBuffer = [];
    this.latencyScores = [];
  }
}

export const apixClient = new ApixClient();