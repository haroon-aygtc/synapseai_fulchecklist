import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsResponse,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApixService } from './apix.service';
import { RedisService } from '../../common/redis/redis.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { ApixEvent, ApixConnection, ApixSubscription, ApixChannel, ApixEventType } from './interfaces/apix.interfaces';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'apix',
  transports: ['websocket', 'polling'],
})
export class ApixGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ApixGateway.name);
  private connections: Map<string, ApixConnection> = new Map();
  private subscriptions: Map<string, ApixSubscription> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly apixService: ApixService,
    private readonly redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('APIX WebSocket Gateway initialized');
    
    // Subscribe to Redis channels for cross-instance communication
    this.redisService.subscribe('apix:events', (channel, message) => {
      try {
        const event = JSON.parse(message) as ApixEvent;
        this.broadcastEvent(event);
      } catch (error) {
        this.logger.error(`Error processing Redis message: ${error.message}`);
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      // Authenticate client
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('Authentication token is missing');
      }

      const payload = this.jwtService.verify(token);
      const { sub: userId, organizationId } = payload;

      // Create connection record
      const connection: ApixConnection = {
        id: client.id,
        userId,
        organizationId,
        socketId: client.id,
        isConnected: true,
        lastPingAt: new Date(),
        subscriptions: [],
        metadata: {
          userAgent: client.handshake.headers['user-agent'] as string,
          ipAddress: client.handshake.address,
          connectionTime: new Date(),
          reconnectCount: 0,
        },
      };

      // Store connection
      this.connections.set(client.id, connection);
      
      // Join organization room
      client.join(`org:${organizationId}`);
      
      // Log connection
      this.logger.log(`Client connected: ${client.id} (User: ${userId}, Org: ${organizationId})`);
      
      // Emit connection event
      client.emit('connected', { 
        connectionId: client.id,
        timestamp: new Date(),
        status: 'connected',
      });
      
      // Track connection in Redis for metrics
      await this.redisService.sadd(`apix:connections:org:${organizationId}`, client.id);
      await this.redisService.set(`apix:connection:${client.id}`, JSON.stringify(connection), 86400); // 24h TTL
      
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const connection = this.connections.get(client.id);
      if (connection) {
        // Update connection status
        connection.isConnected = false;
        
        // Clean up subscriptions
        for (const subId of connection.subscriptions) {
          this.subscriptions.delete(subId);
        }
        
        // Remove from Redis
        if (connection.organizationId) {
          await this.redisService.srem(`apix:connections:org:${connection.organizationId}`, client.id);
        }
        await this.redisService.del(`apix:connection:${client.id}`);
        
        // Remove from memory
        this.connections.delete(client.id);
        
        this.logger.log(`Client disconnected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('event')
  async handleEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() event: ApixEvent,
  ): Promise<WsResponse<any>> {
    try {
      const connection = this.connections.get(client.id);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Validate event
      if (!event.id || !event.type || !event.channel) {
        throw new Error('Invalid event format');
      }

      // Add metadata
      event.metadata = {
        ...event.metadata,
        timestamp: new Date(),
        userId: connection.userId,
        organizationId: connection.organizationId,
        source: 'client',
      };

      // Process event
      await this.apixService.processEvent(event);
      
      // Broadcast to relevant subscribers
      this.broadcastEvent(event);
      
      return { event: 'event_processed', data: { id: event.id } };
    } catch (error) {
      this.logger.error(`Event error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { subscriptionId: string; channel: string; filters?: Record<string, any> },
  ): Promise<WsResponse<any>> {
    try {
      const connection = this.connections.get(client.id);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Create subscription
      const subscription: ApixSubscription = {
        id: data.subscriptionId,
        channel: data.channel,
        userId: connection.userId,
        organizationId: connection.organizationId,
        filters: data.filters || {},
        isActive: true,
        createdAt: new Date(),
      };

      // Store subscription
      this.subscriptions.set(data.subscriptionId, subscription);
      connection.subscriptions.push(data.subscriptionId);
      
      // Join channel room
      client.join(`channel:${data.channel}`);
      
      // Store in Redis for cross-instance awareness
      await this.redisService.set(
        `apix:subscription:${data.subscriptionId}`, 
        JSON.stringify(subscription), 
        86400
      ); // 24h TTL
      
      this.logger.log(`Client ${client.id} subscribed to ${data.channel}`);
      
      return { event: 'subscribed', data: { subscriptionId: data.subscriptionId } };
    } catch (error) {
      this.logger.error(`Subscribe error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { subscriptionId: string },
  ): Promise<WsResponse<any>> {
    try {
      const connection = this.connections.get(client.id);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const subscription = this.subscriptions.get(data.subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Validate ownership
      if (subscription.userId !== connection.userId) {
        throw new Error('Unauthorized to unsubscribe');
      }

      // Remove subscription
      this.subscriptions.delete(data.subscriptionId);
      connection.subscriptions = connection.subscriptions.filter(id => id !== data.subscriptionId);
      
      // Leave channel room if no more subscriptions
      const hasMoreSubscriptions = Array.from(this.subscriptions.values()).some(
        sub => sub.userId === connection.userId && sub.channel === subscription.channel
      );
      
      if (!hasMoreSubscriptions) {
        client.leave(`channel:${subscription.channel}`);
      }
      
      // Remove from Redis
      await this.redisService.del(`apix:subscription:${data.subscriptionId}`);
      
      this.logger.log(`Client ${client.id} unsubscribed from ${subscription.channel}`);
      
      return { event: 'unsubscribed', data: { subscriptionId: data.subscriptionId } };
    } catch (error) {
      this.logger.error(`Unsubscribe error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<WsResponse<any>> {
    try {
      const connection = this.connections.get(client.id);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Join room
      client.join(`room:${data.roomId}`);
      
      // Emit room joined event
      client.emit('room_joined', data.roomId);
      
      this.logger.log(`Client ${client.id} joined room ${data.roomId}`);
      
      return { event: 'room_joined', data: { roomId: data.roomId } };
    } catch (error) {
      this.logger.error(`Join room error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<WsResponse<any>> {
    try {
      const connection = this.connections.get(client.id);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Leave room
      client.leave(`room:${data.roomId}`);
      
      // Emit room left event
      client.emit('room_left', data.roomId);
      
      this.logger.log(`Client ${client.id} left room ${data.roomId}`);
      
      return { event: 'room_left', data: { roomId: data.roomId } };
    } catch (error) {
      this.logger.error(`Leave room error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('broadcast')
  async handleBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { event: ApixEvent; roomId?: string },
  ): Promise<WsResponse<any>> {
    try {
      const connection = this.connections.get(client.id);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Add metadata
      data.event.metadata = {
        ...data.event.metadata,
        timestamp: new Date(),
        userId: connection.userId,
        organizationId: connection.organizationId,
        source: 'client-broadcast',
      };

      // Broadcast to room or organization
      if (data.roomId) {
        this.server.to(`room:${data.roomId}`).emit('event', data.event);
      } else {
        this.server.to(`org:${connection.organizationId}`).emit('event', data.event);
      }
      
      this.logger.log(`Client ${client.id} broadcast event ${data.event.type}`);
      
      return { event: 'broadcast_sent', data: { id: data.event.id } };
    } catch (error) {
      this.logger.error(`Broadcast error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() timestamp: number,
  ): WsResponse<any> {
    try {
      const connection = this.connections.get(client.id);
      if (connection) {
        connection.lastPingAt = new Date();
      }
      
      return { event: 'pong', data: timestamp };
    } catch (error) {
      this.logger.error(`Ping error: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  // Helper methods
  private broadcastEvent(event: ApixEvent): void {
    try {
      // Broadcast to organization
      if (event.metadata?.organizationId) {
        this.server.to(`org:${event.metadata.organizationId}`).emit('event', event);
      }
      
      // Broadcast to channel subscribers
      this.server.to(`channel:${event.channel}`).emit('event', event);
      
      // Broadcast to specific room if applicable
      if (event.metadata?.roomId) {
        this.server.to(`room:${event.metadata.roomId}`).emit('event', event);
      }
    } catch (error) {
      this.logger.error(`Broadcast error: ${error.message}`);
    }
  }
}