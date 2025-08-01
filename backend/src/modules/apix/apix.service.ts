import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { ApixEvent, ApixMetrics } from './interfaces/apix.interfaces';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ApixService {
  private readonly logger = new Logger(ApixService.name);
  private eventBuffer: ApixEvent[] = [];
  private readonly bufferSize = 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processEvent(event: ApixEvent): Promise<void> {
    try {
      // Store event in buffer
      this.bufferEvent(event);
      
      // Publish to Redis for cross-instance communication
      await this.redisService.publish('apix:events', JSON.stringify(event));
      
      // Emit local event for services to react
      this.eventEmitter.emit(`apix.${event.channel}.${event.type}`, event);
      
      // Track metrics
      await this.trackEventMetrics(event);
      
      this.logger.debug(`Processed event: ${event.id} (${event.type})`);
    } catch (error) {
      this.logger.error(`Error processing event: ${error.message}`);
      throw error;
    }
  }

  async emitEvent(event: ApixEvent): Promise<void> {
    try {
      // Add timestamp if not present
      if (!event.metadata) {
        event.metadata = { timestamp: new Date(), source: 'server' };
      } else if (!event.metadata.timestamp) {
        event.metadata.timestamp = new Date();
      }
      
      // Process the event
      await this.processEvent(event);
    } catch (error) {
      this.logger.error(`Error emitting event: ${error.message}`);
      throw error;
    }
  }

  async getRecentEvents(
    channel?: string,
    limit: number = 100,
    organizationId?: string,
  ): Promise<ApixEvent[]> {
    try {
      let events = [...this.eventBuffer];
      
      // Filter by channel if specified
      if (channel) {
        events = events.filter(event => event.channel === channel);
      }
      
      // Filter by organization if specified
      if (organizationId) {
        events = events.filter(event => event.metadata?.organizationId === organizationId);
      }
      
      // Return most recent events
      return events.slice(-limit);
    } catch (error) {
      this.logger.error(`Error getting recent events: ${error.message}`);
      return [];
    }
  }

  async getMetrics(organizationId?: string): Promise<ApixMetrics> {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      // Get active connections
      let activeConnections = 0;
      if (organizationId) {
        const connections = await this.redisService.smembers(`apix:connections:org:${organizationId}`);
        activeConnections = connections.length;
      } else {
        // Get all connections (in a real implementation, this would be more efficient)
        const keys = await this.redisService.getClient().keys('apix:connections:org:*');
        for (const key of keys) {
          const connections = await this.redisService.smembers(key);
          activeConnections += connections.length;
        }
      }
      
      // Get events per second
      const recentEvents = this.eventBuffer.filter(
        event => new Date(event.metadata.timestamp) >= oneMinuteAgo
      );
      const eventsPerSecond = recentEvents.length / 60;
      
      // Get average latency (mock data for now)
      const averageLatency = 50; // ms
      
      // Get error rate
      const errorEvents = recentEvents.filter(
        event => event.type.includes('ERROR') || event.type.includes('FAILED')
      );
      const errorRate = recentEvents.length > 0 ? errorEvents.length / recentEvents.length : 0;
      
      // Get events by channel
      const eventsByChannel: Record<string, number> = {};
      for (const event of recentEvents) {
        eventsByChannel[event.channel] = (eventsByChannel[event.channel] || 0) + 1;
      }
      
      // Get connections by organization
      const connectionsByOrganization: Record<string, number> = {};
      if (organizationId) {
        connectionsByOrganization[organizationId] = activeConnections;
      } else {
        const keys = await this.redisService.getClient().keys('apix:connections:org:*');
        for (const key of keys) {
          const orgId = key.split(':').pop();
          const connections = await this.redisService.smembers(key);
          connectionsByOrganization[orgId] = connections.length;
        }
      }
      
      return {
        totalConnections: activeConnections,
        activeConnections,
        totalEvents: this.eventBuffer.length,
        eventsPerSecond,
        averageLatency,
        errorRate,
        connectionsByOrganization,
        eventsByChannel,
        timestamp: now,
      };
    } catch (error) {
      this.logger.error(`Error getting metrics: ${error.message}`);
      return {
        totalConnections: 0,
        activeConnections: 0,
        totalEvents: 0,
        eventsPerSecond: 0,
        averageLatency: 0,
        errorRate: 0,
        connectionsByOrganization: {},
        eventsByChannel: {},
        timestamp: new Date(),
      };
    }
  }

  private bufferEvent(event: ApixEvent): void {
    this.eventBuffer.push(event);
    
    // Keep buffer size limited
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.bufferSize);
    }
  }

  private async trackEventMetrics(event: ApixEvent): Promise<void> {
    try {
      const organizationId = event.metadata?.organizationId;
      if (!organizationId) return;
      
      // Increment event counter
      const key = `apix:metrics:events:${organizationId}:${event.channel}:${new Date().toISOString().split('T')[0]}`;
      await this.redisService.incrementRateLimit(key, 86400); // 24h TTL
      
      // Track event type distribution
      const typeKey = `apix:metrics:event_types:${organizationId}:${event.type}:${new Date().toISOString().split('T')[0]}`;
      await this.redisService.incrementRateLimit(typeKey, 86400); // 24h TTL
    } catch (error) {
      this.logger.error(`Error tracking event metrics: ${error.message}`);
    }
  }
}