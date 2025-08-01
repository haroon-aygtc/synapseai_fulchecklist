import Redis from 'ioredis';
import { Session, User, Organization } from './types';

class RedisSessionManager {
  private redis: Redis;
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly ORG_SESSIONS_PREFIX = 'org_sessions:';
  private readonly SESSION_MEMORY_PREFIX = 'session_memory:';
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      keyPrefix: 'synapseai:',
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      // Redis connection established successfully
    });
  }

  async createSession(session: Session): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${session.id}`;
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${session.userId}`;
    const orgSessionsKey = `${this.ORG_SESSIONS_PREFIX}${session.organizationId}`;

    const pipeline = this.redis.pipeline();
    
    // Store session data
    pipeline.hset(sessionKey, {
      id: session.id,
      userId: session.userId,
      organizationId: session.organizationId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive.toString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      createdAt: session.createdAt.toISOString()
    });

    // Set TTL for session
    pipeline.expire(sessionKey, this.DEFAULT_TTL);

    // Add session to user's session set
    pipeline.sadd(userSessionsKey, session.id);
    pipeline.expire(userSessionsKey, this.DEFAULT_TTL);

    // Add session to organization's session set
    pipeline.sadd(orgSessionsKey, session.id);
    pipeline.expire(orgSessionsKey, this.DEFAULT_TTL);

    await pipeline.exec();
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const sessionData = await this.redis.hgetall(sessionKey);

    if (!sessionData.id) {
      return null;
    }

    return {
      id: sessionData.id,
      userId: sessionData.userId,
      organizationId: sessionData.organizationId,
      token: sessionData.token,
      refreshToken: sessionData.refreshToken,
      expiresAt: new Date(sessionData.expiresAt),
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      isActive: sessionData.isActive === 'true',
      lastActivityAt: new Date(sessionData.lastActivityAt),
      createdAt: new Date(sessionData.createdAt)
    };
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const now = new Date().toISOString();

    await this.redis.hset(sessionKey, 'lastActivityAt', now);
    await this.redis.expire(sessionKey, this.DEFAULT_TTL);
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${session.userId}`;
    const orgSessionsKey = `${this.ORG_SESSIONS_PREFIX}${session.organizationId}`;
    const memoryKey = `${this.SESSION_MEMORY_PREFIX}${sessionId}`;

    const pipeline = this.redis.pipeline();
    pipeline.del(sessionKey);
    pipeline.srem(userSessionsKey, sessionId);
    pipeline.srem(orgSessionsKey, sessionId);
    pipeline.del(memoryKey);

    await pipeline.exec();
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);

    if (sessionIds.length === 0) return;

    const pipeline = this.redis.pipeline();
    
    for (const sessionId of sessionIds) {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      const memoryKey = `${this.SESSION_MEMORY_PREFIX}${sessionId}`;
      pipeline.del(sessionKey);
      pipeline.del(memoryKey);
    }

    pipeline.del(userSessionsKey);
    await pipeline.exec();
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);

    if (sessionIds.length === 0) return [];

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session && session.isActive) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async getOrganizationSessions(organizationId: string): Promise<Session[]> {
    const orgSessionsKey = `${this.ORG_SESSIONS_PREFIX}${organizationId}`;
    const sessionIds = await this.redis.smembers(orgSessionsKey);

    if (sessionIds.length === 0) return [];

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session && session.isActive) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  // Session Memory Management
  async setSessionMemory(sessionId: string, key: string, value: any, ttl?: number): Promise<void> {
    const memoryKey = `${this.SESSION_MEMORY_PREFIX}${sessionId}:${key}`;
    const serializedValue = JSON.stringify(value);
    
    await this.redis.set(memoryKey, serializedValue);
    if (ttl) {
      await this.redis.expire(memoryKey, ttl);
    } else {
      await this.redis.expire(memoryKey, this.DEFAULT_TTL);
    }
  }

  async getSessionMemory(sessionId: string, key: string): Promise<any> {
    const memoryKey = `${this.SESSION_MEMORY_PREFIX}${sessionId}:${key}`;
    const value = await this.redis.get(memoryKey);
    
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async deleteSessionMemory(sessionId: string, key: string): Promise<void> {
    const memoryKey = `${this.SESSION_MEMORY_PREFIX}${sessionId}:${key}`;
    await this.redis.del(memoryKey);
  }

  async getSessionMemoryKeys(sessionId: string): Promise<string[]> {
    const pattern = `${this.SESSION_MEMORY_PREFIX}${sessionId}:*`;
    const keys = await this.redis.keys(pattern);
    return keys.map(key => key.replace(`${this.SESSION_MEMORY_PREFIX}${sessionId}:`, ''));
  }

  async clearSessionMemory(sessionId: string): Promise<void> {
    const pattern = `${this.SESSION_MEMORY_PREFIX}${sessionId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Memory pruning for performance
  async pruneSessionMemory(sessionId: string, maxKeys: number = 100): Promise<void> {
    const keys = await this.getSessionMemoryKeys(sessionId);
    
    if (keys.length <= maxKeys) return;

    // Sort by last access time and remove oldest
    const keysWithTtl = await Promise.all(
      keys.map(async (key) => {
        const memoryKey = `${this.SESSION_MEMORY_PREFIX}${sessionId}:${key}`;
        const ttl = await this.redis.ttl(memoryKey);
        return { key, ttl };
      })
    );

    const sortedKeys = keysWithTtl
      .sort((a, b) => a.ttl - b.ttl)
      .slice(0, keys.length - maxKeys)
      .map(item => item.key);

    for (const key of sortedKeys) {
      await this.deleteSessionMemory(sessionId, key);
    }
  }

  // Analytics and monitoring
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    sessionsPerOrg: Record<string, number>;
  }> {
    const sessionKeys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    const totalSessions = sessionKeys.length;
    
    let activeSessions = 0;
    const sessionsPerOrg: Record<string, number> = {};

    for (const sessionKey of sessionKeys) {
      const sessionData = await this.redis.hgetall(sessionKey);
      if (sessionData.isActive === 'true') {
        activeSessions++;
        const orgId = sessionData.organizationId;
        sessionsPerOrg[orgId] = (sessionsPerOrg[orgId] || 0) + 1;
      }
    }

    return {
      totalSessions,
      activeSessions,
      sessionsPerOrg
    };
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const sessionKeys = await this.redis.keys(`${this.SESSION_PREFIX}*`);

    for (const sessionKey of sessionKeys) {
      const sessionData = await this.redis.hgetall(sessionKey);
      const expiresAt = new Date(sessionData.expiresAt).getTime();
      
      if (expiresAt < now) {
        const sessionId = sessionData.id;
        await this.invalidateSession(sessionId);
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

export const sessionManager = new RedisSessionManager();