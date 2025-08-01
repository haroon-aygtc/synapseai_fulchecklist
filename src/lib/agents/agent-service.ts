import { Agent, AgentType, AgentStatus, AgentSession, AgentMemory, AgentTask, AgentCollaboration } from './types';
import { z } from 'zod';

export class AgentService {
  private baseUrl = '/api/agents';
  private redisClient: any; // Redis client for session memory

  constructor() {
    // Initialize Redis client for session memory
    this.initializeRedis();
  }

  private async initializeRedis() {
    // Redis initialization for persistent memory
    // This would connect to Redis in production
  }

  // Agent CRUD Operations
  async createAgent(config: Partial<Agent>): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getAgent(id: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update agent: ${response.statusText}`);
    }
    
    return response.json();
  }

  async deleteAgent(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete agent: ${response.statusText}`);
    }
  }

  async listAgents(organizationId: string, filters?: any): Promise<Agent[]> {
    const params = new URLSearchParams({
      organizationId,
      ...filters
    });
    
    const response = await fetch(`${this.baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to list agents: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Agent Session Management
  async createSession(agentId: string, userId?: string): Promise<AgentSession> {
    const response = await fetch(`${this.baseUrl}/${agentId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getSession(sessionId: string): Promise<AgentSession> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateSessionMemory(sessionId: string, memory: Partial<AgentMemory>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/memory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update session memory: ${response.statusText}`);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/end`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to end session: ${response.statusText}`);
    }
  }

  // Agent-to-Agent Collaboration
  async createCollaboration(participants: string[], roomName?: string): Promise<AgentCollaboration> {
    const response = await fetch(`${this.baseUrl}/collaborations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants, roomName })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create collaboration: ${response.statusText}`);
    }
    
    return response.json();
  }

  async joinCollaboration(collaborationId: string, agentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collaborations/${collaborationId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to join collaboration: ${response.statusText}`);
    }
  }

  async sendMessage(collaborationId: string, fromAgentId: string, message: any, toAgentId?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collaborations/${collaborationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromAgentId, toAgentId, message })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  // Task Management
  async createTask(sessionId: string, task: Partial<AgentTask>): Promise<AgentTask> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateTask(taskId: string, updates: Partial<AgentTask>): Promise<AgentTask> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update task: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getSessionTasks(sessionId: string): Promise<AgentTask[]> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/tasks`);
    
    if (!response.ok) {
      throw new Error(`Failed to get session tasks: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Agent Templates
  async getTemplates(category?: string): Promise<any[]> {
    const params = category ? `?category=${category}` : '';
    const response = await fetch(`${this.baseUrl}/templates${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get templates: ${response.statusText}`);
    }
    
    return response.json();
  }

  async createFromTemplate(templateId: string, config: any): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create agent from template: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Agent Testing & Debugging
  async testAgent(agentId: string, input: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${agentId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to test agent: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getDebugInfo(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/debug`);
    
    if (!response.ok) {
      throw new Error(`Failed to get debug info: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Memory Management
  async pruneMemory(sessionId: string, strategy: 'fifo' | 'lru' | 'intelligent' = 'intelligent'): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/memory/prune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to prune memory: ${response.statusText}`);
    }
  }

  async getMemoryStats(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/memory/stats`);
    
    if (!response.ok) {
      throw new Error(`Failed to get memory stats: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Analytics
  async getAnalytics(agentId: string, period: string = '7d'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${agentId}/analytics?period=${period}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get analytics: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Version Management
  async createVersion(agentId: string, changelog: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${agentId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changelog })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create version: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getVersions(agentId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${agentId}/versions`);
    
    if (!response.ok) {
      throw new Error(`Failed to get versions: ${response.statusText}`);
    }
    
    return response.json();
  }

  async rollbackToVersion(agentId: string, versionId: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/versions/${versionId}/rollback`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to rollback to version: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Skill Management
  async addSkill(agentId: string, skill: any): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${agentId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add skill: ${response.statusText}`);
    }
  }

  async removeSkill(agentId: string, skillId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${agentId}/skills/${skillId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to remove skill: ${response.statusText}`);
    }
  }

  async getAvailableSkills(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/skills`);
    
    if (!response.ok) {
      throw new Error(`Failed to get available skills: ${response.statusText}`);
    }
    
    return response.json();
  }
}