export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: 'STANDALONE' | 'TOOL_DRIVEN' | 'HYBRID' | 'MULTI_TASK' | 'MULTI_PROVIDER';
  systemPrompt?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  skills: any[];
  config: Record<string, any>;
  metadata: Record<string, any>;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSession {
  id: string;
  sessionId: string;
  agentId: string;
  userId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';
  context: Record<string, any>;
  memory: Record<string, any>;
  messages: any[];
  metadata: Record<string, any>;
  duration?: number;
  startedAt: string;
  lastActivityAt: string;
  endedAt?: string;
}

export interface AgentTestResult {
  response: string;
  metadata: {
    duration: number;
    tokensUsed?: number;
    model: string;
    provider?: string;
    cost?: number;
  };
}

export interface AgentCollaboration {
  id: string;
  initiatorAgentId: string;
  collaborators: string[];
  task: string;
  strategy: 'sequential' | 'parallel' | 'hierarchical' | 'democratic';
  status: 'active' | 'completed' | 'failed';
  progress: number;
  results?: any;
  startedAt: string;
  completedAt?: string;
}

export class AgentService {
  private baseUrl = '/api/agents';

  // Core Agent Management
  async getAgents(filters?: {
    type?: string;
    isActive?: boolean;
    search?: string;
    tags?: string[];
  }): Promise<Agent[]> {
    const params = new URLSearchParams();
    
    if (filters?.type) params.append('type', filters.type);
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.tags) filters.tags.forEach(tag => params.append('tags', tag));

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get agents: ${response.statusText}`);
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

  async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`);
    }

    return response.json();
  }

  async updateAgent(id: string, agentData: Partial<Agent>): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData)
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

  async cloneAgent(id: string, options?: { name?: string; description?: string }): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    });

    if (!response.ok) {
      throw new Error(`Failed to clone agent: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Testing
  async testAgent(id: string, input: any): Promise<AgentTestResult> {
    const response = await fetch(`${this.baseUrl}/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });

    if (!response.ok) {
      throw new Error(`Failed to test agent: ${response.statusText}`);
    }

    return response.json();
  }

  // Session Management
  async createSession(agentId: string, options?: {
    context?: Record<string, any>;
    initialMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<AgentSession> {
    const response = await fetch(`${this.baseUrl}/${agentId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return response.json();
  }

  async getSessions(agentId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: AgentSession[]; total: number }> {
    const params = new URLSearchParams();
    
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await fetch(`${this.baseUrl}/${agentId}/sessions?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.statusText}`);
    }

    return response.json();
  }

  async sendMessage(sessionId: string, message: {
    message: string;
    role?: 'user' | 'assistant' | 'system';
    metadata?: Record<string, any>;
  }): Promise<{ response: string; metadata: any }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  async endSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/end`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to end session: ${response.statusText}`);
    }
  }

  // Agent Collaboration
  async initiateCollaboration(
    initiatorAgentId: string,
    collaboratorAgentIds: string[],
    context: {
      task: string;
      strategy: 'sequential' | 'parallel' | 'hierarchical' | 'democratic';
      priority: 'low' | 'medium' | 'high' | 'urgent';
      deadline?: string;
      sharedResources?: any;
      constraints?: any;
    }
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${initiatorAgentId}/collaborate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collaboratorAgentIds,
        context
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate collaboration: ${response.statusText}`);
    }

    const { collaborationId } = await response.json();
    return collaborationId;
  }

  async sendCollaborationMessage(
    collaborationId: string,
    fromAgentId: string,
    toAgentId: string | 'all',
    message: {
      type: 'task_request' | 'task_response' | 'information_share' | 'consensus_vote' | 'coordination';
      content: any;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      requiresResponse: boolean;
      deadline?: string;
      metadata?: any;
    }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collaborations/${collaborationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAgentId,
        toAgentId,
        ...message
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send collaboration message: ${response.statusText}`);
    }
  }

  async getCollaboration(collaborationId: string): Promise<AgentCollaboration> {
    const response = await fetch(`${this.baseUrl}/collaborations/${collaborationId}`);
    if (!response.ok) {
      throw new Error(`Failed to get collaboration: ${response.statusText}`);
    }

    return response.json();
  }

  async getCollaborations(agentId?: string): Promise<AgentCollaboration[]> {
    const params = agentId ? `?agentId=${agentId}` : '';
    const response = await fetch(`${this.baseUrl}/collaborations${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get collaborations: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Analytics
  async getAgentAnalytics(agentId: string, timeRange: string = '7d'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${agentId}/analytics?timeRange=${timeRange}`);
    if (!response.ok) {
      throw new Error(`Failed to get agent analytics: ${response.statusText}`);
    }

    return response.json();
  }

  async getAgentPerformanceMetrics(agentId: string): Promise<{
    totalSessions: number;
    totalMessages: number;
    avgResponseTime: number;
    successRate: number;
    lastUsed?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/${agentId}/metrics`);
    if (!response.ok) {
      throw new Error(`Failed to get agent metrics: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Templates and Marketplace
  async getAgentTemplates(category?: string): Promise<any[]> {
    const params = category ? `?category=${category}` : '';
    const response = await fetch(`${this.baseUrl}/templates${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get agent templates: ${response.statusText}`);
    }

    return response.json();
  }

  async createAgentFromTemplate(templateId: string, customizations?: any): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customizations || {})
    });

    if (!response.ok) {
      throw new Error(`Failed to create agent from template: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Skills Management
  async addSkillToAgent(agentId: string, skill: {
    name: string;
    description: string;
    parameters: Record<string, any>;
    code?: string;
  }): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill)
    });

    if (!response.ok) {
      throw new Error(`Failed to add skill to agent: ${response.statusText}`);
    }

    return response.json();
  }

  async removeSkillFromAgent(agentId: string, skillId: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/skills/${skillId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to remove skill from agent: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Tools Management
  async addToolToAgent(agentId: string, toolId: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId })
    });

    if (!response.ok) {
      throw new Error(`Failed to add tool to agent: ${response.statusText}`);
    }

    return response.json();
  }

  async removeToolFromAgent(agentId: string, toolId: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/tools/${toolId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to remove tool from agent: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Memory Management
  async getAgentMemory(agentId: string, sessionId?: string): Promise<{
    conversationHistory: any[];
    semanticMemory: any[];
    episodicMemory: any[];
    workingMemory: any;
  }> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    const response = await fetch(`${this.baseUrl}/${agentId}/memory${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get agent memory: ${response.statusText}`);
    }

    return response.json();
  }

  async clearAgentMemory(agentId: string, memoryType?: 'conversation' | 'semantic' | 'episodic' | 'working'): Promise<void> {
    const params = memoryType ? `?type=${memoryType}` : '';
    const response = await fetch(`${this.baseUrl}/${agentId}/memory/clear${params}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to clear agent memory: ${response.statusText}`);
    }
  }

  // Agent Configuration
  async updateAgentConfig(agentId: string, config: Record<string, any>): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error(`Failed to update agent config: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Versioning
  async createAgentVersion(agentId: string, versionData?: {
    description?: string;
    changes?: string[];
  }): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(versionData || {})
    });

    if (!response.ok) {
      throw new Error(`Failed to create agent version: ${response.statusText}`);
    }

    return response.json();
  }

  async getAgentVersions(agentId: string): Promise<Agent[]> {
    const response = await fetch(`${this.baseUrl}/${agentId}/versions`);
    if (!response.ok) {
      throw new Error(`Failed to get agent versions: ${response.statusText}`);
    }

    return response.json();
  }

  async revertToAgentVersion(agentId: string, versionId: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/${agentId}/versions/${versionId}/revert`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to revert to agent version: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Import/Export
  async exportAgent(agentId: string, format: 'json' | 'yaml' = 'json'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/${agentId}/export?format=${format}`);
    if (!response.ok) {
      throw new Error(`Failed to export agent: ${response.statusText}`);
    }

    return response.blob();
  }

  async importAgent(agentData: any, options?: {
    overwrite?: boolean;
    preserveIds?: boolean;
  }): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentData, options: options || {} })
    });

    if (!response.ok) {
      throw new Error(`Failed to import agent: ${response.statusText}`);
    }

    return response.json();
  }

  // Batch Operations
  async batchUpdateAgents(updates: Array<{ id: string; data: Partial<Agent> }>): Promise<Agent[]> {
    const response = await fetch(`${this.baseUrl}/batch`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });

    if (!response.ok) {
      throw new Error(`Failed to batch update agents: ${response.statusText}`);
    }

    return response.json();
  }

  async batchDeleteAgents(agentIds: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/batch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentIds })
    });

    if (!response.ok) {
      throw new Error(`Failed to batch delete agents: ${response.statusText}`);
    }
  }

  // Real-time Agent Monitoring
  async subscribeToAgentEvents(agentId: string, callback: (event: any) => void): Promise<() => void> {
    // This would typically use WebSocket or Server-Sent Events
    // For now, we'll use a simple polling mechanism
    const eventSource = new EventSource(`${this.baseUrl}/${agentId}/events`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Failed to parse agent event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Agent event stream error:', error);
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  // Agent Health Monitoring
  async getAgentHealth(agentId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: string;
    metrics: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
      activeConnections: number;
    };
    issues: string[];
  }> {
    const response = await fetch(`${this.baseUrl}/${agentId}/health`);
    if (!response.ok) {
      throw new Error(`Failed to get agent health: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent Debugging
  async getAgentLogs(agentId: string, options?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    limit?: number;
    since?: string;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options?.level) params.append('level', options.level);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.since) params.append('since', options.since);

    const response = await fetch(`${this.baseUrl}/${agentId}/logs?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get agent logs: ${response.statusText}`);
    }

    return response.json();
  }

  async debugAgentExecution(agentId: string, input: any, options?: {
    stepThrough?: boolean;
    captureMemory?: boolean;
    captureTools?: boolean;
  }): Promise<{
    result: any;
    debugInfo: {
      steps: any[];
      memorySnapshots?: any[];
      toolCalls?: any[];
      performance: {
        totalTime: number;
        stepTimes: number[];
      };
    };
  }> {
    const response = await fetch(`${this.baseUrl}/${agentId}/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, options: options || {} })
    });

    if (!response.ok) {
      throw new Error(`Failed to debug agent execution: ${response.statusText}`);
    }

    return response.json();
  }
}