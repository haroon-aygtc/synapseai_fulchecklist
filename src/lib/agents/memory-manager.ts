import Redis from 'ioredis';
import { 
  Agent, 
  AgentSession, 
  AgentMemory, 
  AgentEpisode, 
  AgentTask, 
  AgentStatus,
  TaskStatus,
  AgentCollaboration,
  AgentMessage,
  AgentRoom
} from './types';

class AgentMemoryManager {
  private redis: Redis;
  private readonly MEMORY_PREFIX = 'agent_memory:';
  private readonly SESSION_PREFIX = 'agent_session:';
  private readonly COLLABORATION_PREFIX = 'agent_collab:';
  private readonly ROOM_PREFIX = 'agent_room:';
  private readonly TASK_PREFIX = 'agent_task:';
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_AGENT_DB || '1'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      keyPrefix: 'synapseai:agents:',
    });

    this.redis.on('error', (error) => {
      console.error('Agent Redis connection error:', error);
    });
  }

  // Agent Memory Management
  async createAgentMemory(agentId: string, sessionId: string): Promise<AgentMemory> {
    const memory: AgentMemory = {
      shortTerm: {},
      longTerm: {},
      episodic: [],
      semantic: {},
      working: {},
      metadata: {
        totalSize: 0,
        lastPruned: new Date(),
        version: 1
      }
    };

    await this.setAgentMemory(agentId, sessionId, memory);
    return memory;
  }

  async getAgentMemory(agentId: string, sessionId: string): Promise<AgentMemory | null> {
    const memoryKey = `${this.MEMORY_PREFIX}${agentId}:${sessionId}`;
    const memoryData = await this.redis.get(memoryKey);
    
    if (!memoryData) return null;
    
    try {
      return JSON.parse(memoryData);
    } catch (error) {
      console.error('Error parsing agent memory:', error);
      return null;
    }
  }

  async setAgentMemory(agentId: string, sessionId: string, memory: AgentMemory): Promise<void> {
    const memoryKey = `${this.MEMORY_PREFIX}${agentId}:${sessionId}`;
    const serializedMemory = JSON.stringify(memory);
    
    await this.redis.set(memoryKey, serializedMemory, 'EX', this.DEFAULT_TTL);
    
    // Update metadata
    memory.metadata.totalSize = serializedMemory.length;
    memory.metadata.version += 1;
  }

  async updateMemorySection(
    agentId: string, 
    sessionId: string, 
    section: keyof Omit<AgentMemory, 'metadata'>, 
    data: any
  ): Promise<void> {
    const memory = await this.getAgentMemory(agentId, sessionId);
    if (!memory) return;

    memory[section] = data;
    await this.setAgentMemory(agentId, sessionId, memory);
  }

  async addEpisode(agentId: string, sessionId: string, episode: Omit<AgentEpisode, 'id'>): Promise<void> {
    const memory = await this.getAgentMemory(agentId, sessionId);
    if (!memory) return;

    const newEpisode: AgentEpisode = {
      id: `episode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...episode
    };

    memory.episodic.push(newEpisode);
    
    // Keep only the most recent 1000 episodes
    if (memory.episodic.length > 1000) {
      memory.episodic = memory.episodic.slice(-1000);
    }

    await this.setAgentMemory(agentId, sessionId, memory);
  }

  async pruneMemory(agentId: string, sessionId: string, strategy: 'fifo' | 'lru' | 'intelligent' = 'intelligent'): Promise<void> {
    const memory = await this.getAgentMemory(agentId, sessionId);
    if (!memory) return;

    switch (strategy) {
      case 'fifo':
        // Remove oldest episodes
        memory.episodic = memory.episodic.slice(-500);
        break;
        
      case 'lru':
        // Remove least recently accessed items (simplified)
        memory.episodic = memory.episodic.slice(-500);
        break;
        
      case 'intelligent':
        // Keep high-importance episodes and recent ones
        const now = Date.now();
        memory.episodic = memory.episodic.filter(episode => {
          const age = now - episode.timestamp.getTime();
          const isRecent = age < 24 * 60 * 60 * 1000; // 24 hours
          const isImportant = episode.importance > 0.7;
          return isRecent || isImportant;
        });
        break;
    }

    memory.metadata.lastPruned = new Date();
    await this.setAgentMemory(agentId, sessionId, memory);
  }

  // Agent Session Management
  async createAgentSession(session: AgentSession): Promise<void> {
    const sessionKey = `${this.SESSION_PREFIX}${session.id}`;
    const agentSessionsKey = `agent_sessions:${session.agentId}`;
    
    const pipeline = this.redis.pipeline();
    pipeline.set(sessionKey, JSON.stringify(session), 'EX', this.DEFAULT_TTL);
    pipeline.sadd(agentSessionsKey, session.id);
    pipeline.expire(agentSessionsKey, this.DEFAULT_TTL);
    
    await pipeline.exec();
    
    // Create initial memory
    await this.createAgentMemory(session.agentId, session.id);
  }

  async getAgentSession(sessionId: string): Promise<AgentSession | null> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) return null;
    
    try {
      const session = JSON.parse(sessionData);
      // Convert date strings back to Date objects
      session.startedAt = new Date(session.startedAt);
      session.lastActivityAt = new Date(session.lastActivityAt);
      if (session.endedAt) session.endedAt = new Date(session.endedAt);
      return session;
    } catch (error) {
      console.error('Error parsing agent session:', error);
      return null;
    }
  }

  async updateAgentSession(sessionId: string, updates: Partial<AgentSession>): Promise<void> {
    const session = await this.getAgentSession(sessionId);
    if (!session) return;

    const updatedSession = { ...session, ...updates, lastActivityAt: new Date() };
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    
    await this.redis.set(sessionKey, JSON.stringify(updatedSession), 'EX', this.DEFAULT_TTL);
  }

  async getAgentSessions(agentId: string): Promise<AgentSession[]> {
    const agentSessionsKey = `agent_sessions:${agentId}`;
    const sessionIds = await this.redis.smembers(agentSessionsKey);
    
    const sessions: AgentSession[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getAgentSession(sessionId);
      if (session) sessions.push(session);
    }
    
    return sessions.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }

  // Task Management
  async createTask(task: AgentTask): Promise<void> {
    const taskKey = `${this.TASK_PREFIX}${task.id}`;
    const sessionTasksKey = `session_tasks:${task.sessionId}`;
    
    const pipeline = this.redis.pipeline();
    pipeline.set(taskKey, JSON.stringify(task), 'EX', this.DEFAULT_TTL);
    pipeline.sadd(sessionTasksKey, task.id);
    pipeline.expire(sessionTasksKey, this.DEFAULT_TTL);
    
    await pipeline.exec();
  }

  async updateTask(taskId: string, updates: Partial<AgentTask>): Promise<void> {
    const taskKey = `${this.TASK_PREFIX}${taskId}`;
    const taskData = await this.redis.get(taskKey);
    
    if (!taskData) return;
    
    try {
      const task = JSON.parse(taskData);
      const updatedTask = { ...task, ...updates };
      
      // Update timestamps based on status
      if (updates.status === TaskStatus.IN_PROGRESS && !task.startedAt) {
        updatedTask.startedAt = new Date();
      } else if (updates.status === TaskStatus.COMPLETED || updates.status === TaskStatus.FAILED) {
        updatedTask.completedAt = new Date();
        if (task.startedAt) {
          updatedTask.actualDuration = updatedTask.completedAt.getTime() - new Date(task.startedAt).getTime();
        }
      }
      
      await this.redis.set(taskKey, JSON.stringify(updatedTask), 'EX', this.DEFAULT_TTL);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  async getTask(taskId: string): Promise<AgentTask | null> {
    const taskKey = `${this.TASK_PREFIX}${taskId}`;
    const taskData = await this.redis.get(taskKey);
    
    if (!taskData) return null;
    
    try {
      const task = JSON.parse(taskData);
      // Convert date strings back to Date objects
      task.createdAt = new Date(task.createdAt);
      if (task.startedAt) task.startedAt = new Date(task.startedAt);
      if (task.completedAt) task.completedAt = new Date(task.completedAt);
      return task;
    } catch (error) {
      console.error('Error parsing task:', error);
      return null;
    }
  }

  async getSessionTasks(sessionId: string): Promise<AgentTask[]> {
    const sessionTasksKey = `session_tasks:${sessionId}`;
    const taskIds = await this.redis.smembers(sessionTasksKey);
    
    const tasks: AgentTask[] = [];
    for (const taskId of taskIds) {
      const task = await this.getTask(taskId);
      if (task) tasks.push(task);
    }
    
    return tasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Agent Collaboration
  async createRoom(room: AgentRoom): Promise<void> {
    const roomKey = `${this.ROOM_PREFIX}${room.id}`;
    await this.redis.set(roomKey, JSON.stringify(room), 'EX', this.DEFAULT_TTL);
  }

  async getRoom(roomId: string): Promise<AgentRoom | null> {
    const roomKey = `${this.ROOM_PREFIX}${roomId}`;
    const roomData = await this.redis.get(roomKey);
    
    if (!roomData) return null;
    
    try {
      const room = JSON.parse(roomData);
      room.createdAt = new Date(room.createdAt);
      room.lastActivityAt = new Date(room.lastActivityAt);
      return room;
    } catch (error) {
      console.error('Error parsing room:', error);
      return null;
    }
  }

  async joinRoom(roomId: string, agentId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;
    
    if (room.participants.length >= room.settings.maxParticipants) {
      return false;
    }
    
    if (!room.participants.includes(agentId)) {
      room.participants.push(agentId);
      room.lastActivityAt = new Date();
      
      const roomKey = `${this.ROOM_PREFIX}${roomId}`;
      await this.redis.set(roomKey, JSON.stringify(room), 'EX', this.DEFAULT_TTL);
    }
    
    return true;
  }

  async leaveRoom(roomId: string, agentId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;
    
    room.participants = room.participants.filter(id => id !== agentId);
    room.lastActivityAt = new Date();
    
    const roomKey = `${this.ROOM_PREFIX}${roomId}`;
    await this.redis.set(roomKey, JSON.stringify(room), 'EX', this.DEFAULT_TTL);
  }

  async sendMessage(roomId: string, message: AgentMessage): Promise<void> {
    const collaborationKey = `${this.COLLABORATION_PREFIX}${roomId}`;
    const collaboration = await this.redis.get(collaborationKey);
    
    let collabData: AgentCollaboration;
    
    if (collaboration) {
      collabData = JSON.parse(collaboration);
    } else {
      collabData = {
        id: roomId,
        roomId,
        participants: [],
        sharedMemory: {},
        messageHistory: [],
        createdAt: new Date(),
        lastActivityAt: new Date()
      };
    }
    
    collabData.messageHistory.push(message);
    collabData.lastActivityAt = new Date();
    
    // Keep only the last 1000 messages
    if (collabData.messageHistory.length > 1000) {
      collabData.messageHistory = collabData.messageHistory.slice(-1000);
    }
    
    await this.redis.set(collaborationKey, JSON.stringify(collabData), 'EX', this.DEFAULT_TTL);
    
    // Publish message to subscribers
    await this.redis.publish(`room:${roomId}:messages`, JSON.stringify(message));
  }

  async getCollaboration(roomId: string): Promise<AgentCollaboration | null> {
    const collaborationKey = `${this.COLLABORATION_PREFIX}${roomId}`;
    const collaborationData = await this.redis.get(collaborationKey);
    
    if (!collaborationData) return null;
    
    try {
      const collaboration = JSON.parse(collaborationData);
      collaboration.createdAt = new Date(collaboration.createdAt);
      collaboration.lastActivityAt = new Date(collaboration.lastActivityAt);
      collaboration.messageHistory = collaboration.messageHistory.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      return collaboration;
    } catch (error) {
      console.error('Error parsing collaboration:', error);
      return null;
    }
  }

  async updateSharedMemory(roomId: string, key: string, value: any): Promise<void> {
    const collaborationKey = `${this.COLLABORATION_PREFIX}${roomId}`;
    const collaboration = await this.redis.get(collaborationKey);
    
    if (!collaboration) return;
    
    try {
      const collabData = JSON.parse(collaboration);
      collabData.sharedMemory[key] = value;
      collabData.lastActivityAt = new Date();
      
      await this.redis.set(collaborationKey, JSON.stringify(collabData), 'EX', this.DEFAULT_TTL);
    } catch (error) {
      console.error('Error updating shared memory:', error);
    }
  }

  // Analytics and Monitoring
  async getMemoryStats(agentId: string): Promise<{
    totalSessions: number;
    totalMemorySize: number;
    averageMemorySize: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    const agentSessionsKey = `agent_sessions:${agentId}`;
    const sessionIds = await this.redis.smembers(agentSessionsKey);
    
    let totalMemorySize = 0;
    let oldestSession: Date | null = null;
    let newestSession: Date | null = null;
    
    for (const sessionId of sessionIds) {
      const memory = await this.getAgentMemory(agentId, sessionId);
      if (memory) {
        totalMemorySize += memory.metadata.totalSize;
        
        const session = await this.getAgentSession(sessionId);
        if (session) {
          if (!oldestSession || session.startedAt < oldestSession) {
            oldestSession = session.startedAt;
          }
          if (!newestSession || session.startedAt > newestSession) {
            newestSession = session.startedAt;
          }
        }
      }
    }
    
    return {
      totalSessions: sessionIds.length,
      totalMemorySize,
      averageMemorySize: sessionIds.length > 0 ? totalMemorySize / sessionIds.length : 0,
      oldestSession,
      newestSession
    };
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const cutoff = now - (this.DEFAULT_TTL * 1000);
    
    // Clean up expired sessions
    const sessionKeys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    for (const sessionKey of sessionKeys) {
      const sessionData = await this.redis.get(sessionKey);
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          const lastActivity = new Date(session.lastActivityAt).getTime();
          if (lastActivity < cutoff) {
            await this.redis.del(sessionKey);
          }
        } catch (error) {
          // Delete corrupted session data
          await this.redis.del(sessionKey);
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

export const agentMemoryManager = new AgentMemoryManager();