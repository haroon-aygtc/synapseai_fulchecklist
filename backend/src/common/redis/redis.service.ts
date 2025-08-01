import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    
    const options = {
      password: redisPassword,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000);
      },
    };

    this.redisClient = new Redis(redisUrl, options);
    this.pubClient = new Redis(redisUrl, options);
    this.subClient = new Redis(redisUrl, options);

    this.redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.pubClient.on('error', (err) => {
      console.error('Redis Pub Client Error:', err);
    });

    this.subClient.on('error', (err) => {
      console.error('Redis Sub Client Error:', err);
    });
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
  }

  getClient(): Redis {
    return this.redisClient;
  }

  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }

  // Key-value operations
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.redisClient.set(key, value, 'EX', ttl);
    }
    return this.redisClient.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.redisClient.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redisClient.expire(key, seconds);
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redisClient.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redisClient.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redisClient.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.redisClient.hdel(key, field);
  }

  // List operations
  async lpush(key: string, value: string): Promise<number> {
    return this.redisClient.lpush(key, value);
  }

  async rpush(key: string, value: string): Promise<number> {
    return this.redisClient.rpush(key, value);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redisClient.lrange(key, start, stop);
  }

  // Set operations
  async sadd(key: string, member: string): Promise<number> {
    return this.redisClient.sadd(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redisClient.smembers(key);
  }

  async srem(key: string, member: string): Promise<number> {
    return this.redisClient.srem(key, member);
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.redisClient.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redisClient.zrange(key, start, stop);
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    return this.pubClient.publish(channel, message);
  }

  async subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void> {
    await this.subClient.subscribe(channel);
    this.subClient.on('message', (ch, message) => {
      if (ch === channel) {
        callback(ch, message);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subClient.unsubscribe(channel);
  }

  // Session management
  async storeSession(sessionId: string, data: any, ttl: number = 3600): Promise<'OK'> {
    return this.set(`session:${sessionId}`, JSON.stringify(data), ttl);
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.get(`session:${sessionId}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<number> {
    return this.del(`session:${sessionId}`);
  }

  // Rate limiting
  async incrementRateLimit(key: string, ttl: number): Promise<number> {
    const count = await this.redisClient.incr(key);
    if (count === 1) {
      await this.redisClient.expire(key, ttl);
    }
    return count;
  }

  // Memory management
  async getMemoryUsage(): Promise<Record<string, string>> {
    return this.redisClient.info('memory');
  }
}