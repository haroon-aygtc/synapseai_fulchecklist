import { z } from 'zod';

// PRODUCTION: Real Agent Types and Interfaces
export interface Agent {
  id: string;
  name: string;
  description: string;
  type: 'standalone' | 'tool-driven' | 'hybrid' | 'multi-task' | 'multi-provider';
  status: 'active' | 'inactive' | 'draft' | 'error';
  model: string;
  provider: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  capabilities: string[];
  tags: string[];
  organizationId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isActive: boolean;
  metadata: {
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    avgResponseTime: number;
    avgCost: number;
    lastExecuted: Date | null;
    popularityScore: number;
  };
}

export interface AgentConfiguration {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: string[];
  fallbackBehavior: 'error' | 'default_response' | 'escalate';
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  costLimits: {
    maxCostPerSession: number;
    maxCostPerMonth: number;
  };
}

export interface AgentAnalytics {
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  avgResponseTime: number;
  avgCost: number;
  costBreakdown: Array<{
    provider: string;
    cost: number;
    percentage: number;
  }>;
  usageOverTime: Array<{
    date: string;
    sessions: number;
    cost: number;
    avgResponseTime: number;
  }>;
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  input: any;
  output?: any;
  error?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  provider: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  metadata: {
    sessionId?: string;
    userId: string;
    organizationId: string;
    toolsUsed: string[];
    retryCount: number;
  };
}

// PRODUCTION: Real Agent Service Implementation
export class AgentService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private wsConnection: WebSocket | null = null;
  private eventSubscribers = new Set<(event: any) => void>();

  constructor() {
    this.initializeWebSocketConnection();
  }

  // PRODUCTION: Real Agent Execution with Provider Integration
  async executeWithProvider(
    agentId: string,
    input: any,
    options: {
      sessionId?: string;
      timeout?: number;
      streaming?: boolean;
      preferredProvider?: string;
      maxCost?: number;
      retryPolicy?: {
        maxRetries: number;
        backoffStrategy: 'linear' | 'exponential';
      };
    } = {}
  ): Promise<AgentExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({
          input,
          options: {
            sessionId: options.sessionId || this.generateSessionId(),
            timeout: options.timeout || 30000,
            streaming: options.streaming || false,
            preferredProvider: options.preferredProvider,
            maxCost: options.maxCost,
            retryPolicy: options.retryPolicy || { maxRetries: 3, backoffStrategy: 'exponential' }
          }
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions');
        }
        if (response.status === 404) {
          throw new Error('Agent not found');
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`Agent execution failed: ${response.status} ${response.statusText}`);
      }

      const execution = await response.json();
      
      // Validate response structure
      if (!this.validateExecutionResponse(execution)) {
        throw new Error('Invalid execution response format');
      }

      return execution;
    } catch (error) {
      console.error('Agent execution error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Agent CRUD Operations
  async getAgents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
    tags?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ agents: Agent[]; total: number; page: number; limit: number }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.type) searchParams.set('type', params.type);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const response = await fetch(`${this.baseUrl}/api/agents?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get agents error:', error);
      throw error;
    }
  }

  async getAgent(id: string): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${id}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Agent not found');
        }
        throw new Error(`Failed to fetch agent: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get agent error:', error);
      throw error;
    }
  }

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create agent: ${response.status} ${response.statusText}`);
      }

      const agent = await response.json();
      
      // Emit real-time event
      this.emitEvent('agent_created', { agent });
      
      return agent;
    } catch (error) {
      console.error('Create agent error:', error);
      throw error;
    }
  }

  async updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update agent: ${response.status} ${response.statusText}`);
      }

      const agent = await response.json();
      
      // Clear cache and emit event
      this.clearAgentCache(id);
      this.emitEvent('agent_updated', { agent });
      
      return agent;
    } catch (error) {
      console.error('Update agent error:', error);
      throw error;
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete agent: ${response.status} ${response.statusText}`);
      }

      // Clear cache and emit event
      this.clearAgentCache(id);
      this.emitEvent('agent_deleted', { agentId: id });
    } catch (error) {
      console.error('Delete agent error:', error);
      throw error;
    }
  }

  async cloneAgent(id: string, name?: string): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        throw new Error(`Failed to clone agent: ${response.status} ${response.statusText}`);
      }

      const agent = await response.json();
      this.emitEvent('agent_created', { agent });
      
      return agent;
    } catch (error) {
      console.error('Clone agent error:', error);
      throw error;
    }
  }

  async testAgent(id: string, message: string): Promise<{
    executionId: string;
    response: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
    cost: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`Agent test failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Test agent error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Agent Sessions Management
  async getAgentSessions(id: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    sessions: Array<{
      id: string;
      startedAt: Date;
      endedAt?: Date;
      messageCount: number;
      status: string;
      cost: number;
      duration?: number;
    }>;
    total: number;
  }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.status) searchParams.set('status', params.status);
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom.toISOString());
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo.toISOString());

      const response = await fetch(`${this.baseUrl}/api/agents/${id}/sessions?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch agent sessions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform timestamps
      data.sessions = data.sessions.map((session: any) => ({
        ...session,
        startedAt: new Date(session.startedAt),
        endedAt: session.endedAt ? new Date(session.endedAt) : undefined
      }));

      return data;
    } catch (error) {
      console.error('Get agent sessions error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Agent Analytics
  async getAgentAnalytics(id: string, timeRange?: string): Promise<AgentAnalytics> {
    try {
      const searchParams = new URLSearchParams();
      if (timeRange) searchParams.set('timeRange', timeRange);

      const response = await fetch(`${this.baseUrl}/api/agents/${id}/analytics?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch agent analytics: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get agent analytics error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Agent Configuration Management
  async updateAgentConfiguration(
    id: string, 
    configuration: Partial<AgentConfiguration>
  ): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${id}/configuration`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(configuration)
      });

      if (!response.ok) {
        throw new Error(`Failed to update agent configuration: ${response.status} ${response.statusText}`);
      }

      const agent = await response.json();
      this.clearAgentCache(id);
      this.emitEvent('agent_configuration_updated', { agent });
      
      return agent;
    } catch (error) {
      console.error('Update agent configuration error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Agent Templates
  async getAgentTemplates(category?: string): Promise<Agent[]> {
    try {
      const searchParams = new URLSearchParams();
      if (category) searchParams.set('category', category);

      const response = await fetch(`${this.baseUrl}/api/agents/templates?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch agent templates: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get agent templates error:', error);
      throw error;
    }
  }

  async createFromTemplate(templateId: string, data: {
    name: string;
    description?: string;
    configuration?: Partial<AgentConfiguration>;
  }): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/templates/${templateId}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to create agent from template: ${response.status} ${response.statusText}`);
      }

      const agent = await response.json();
      this.emitEvent('agent_created', { agent });
      
      return agent;
    } catch (error) {
      console.error('Create from template error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Import/Export
  async exportAgent(id: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${id}/export`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to export agent: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export agent error:', error);
      throw error;
    }
  }

  async importAgent(file: File): Promise<Agent> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/api/agents/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to import agent: ${response.status} ${response.statusText}`);
      }

      const agent = await response.json();
      this.emitEvent('agent_created', { agent });
      
      return agent;
    } catch (error) {
      console.error('Import agent error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Bulk Operations
  async bulkDelete(ids: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ ids })
      });

      if (!response.ok) {
        throw new Error(`Bulk delete failed: ${response.status} ${response.statusText}`);
      }

      // Clear cache for all deleted agents
      ids.forEach(id => this.clearAgentCache(id));
      this.emitEvent('agents_bulk_deleted', { ids });
    } catch (error) {
      console.error('Bulk delete error:', error);
      throw error;
    }
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/bulk-update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ ids, status })
      });

      if (!response.ok) {
        throw new Error(`Bulk status update failed: ${response.status} ${response.statusText}`);
      }

      // Clear cache for all updated agents
      ids.forEach(id => this.clearAgentCache(id));
      this.emitEvent('agents_bulk_updated', { ids, status });
    } catch (error) {
      console.error('Bulk update status error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real-time Memory Management
  async getAgentMemory(agentId: string, sessionId?: string): Promise<{
    conversationHistory: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: Date;
      metadata?: any;
    }>;
    semanticMemory: Array<{
      id: string;
      content: string;
      embedding: number[];
      relevanceScore: number;
      timestamp: Date;
    }>;
    episodicMemory: Array<{
      id: string;
      event: string;
      context: any;
      timestamp: Date;
    }>;
    workingMemory: any;
  }> {
    try {
      const searchParams = new URLSearchParams();
      if (sessionId) searchParams.set('sessionId', sessionId);

      const response = await fetch(`${this.baseUrl}/api/agents/${agentId}/memory?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch agent memory: ${response.status} ${response.statusText}`);
      }

      const memory = await response.json();
      
      // Transform timestamps
      memory.conversationHistory = memory.conversationHistory.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
      
      memory.semanticMemory = memory.semanticMemory.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
      
      memory.episodicMemory = memory.episodicMemory.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));

      return memory;
    } catch (error) {
      console.error('Get agent memory error:', error);
      throw error;
    }
  }

  async updateAgentMemory(agentId: string, memoryUpdate: {
    conversationHistory?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: any;
    }>;
    semanticMemory?: Array<{
      content: string;
      embedding?: number[];
    }>;
    episodicMemory?: Array<{
      event: string;
      context: any;
    }>;
    workingMemory?: any;
    sessionId?: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${agentId}/memory`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(memoryUpdate)
      });

      if (!response.ok) {
        throw new Error(`Failed to update agent memory: ${response.status} ${response.statusText}`);
      }

      this.emitEvent('agent_memory_updated', { agentId, sessionId: memoryUpdate.sessionId });
    } catch (error) {
      console.error('Update agent memory error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Agent Collaboration
  async initiateCollaboration(initiatorAgentId: string, collaboratorAgentIds: string[], task: {
    description: string;
    context: any;
    strategy: 'sequential' | 'parallel' | 'hierarchical' | 'democratic';
    maxDuration?: number;
  }): Promise<{
    collaborationId: string;
    status: 'initiated' | 'running' | 'completed' | 'failed';
    participants: string[];
    startedAt: Date;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/collaboration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({
          initiatorAgentId,
          collaboratorAgentIds,
          task
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initiate collaboration: ${response.status} ${response.statusText}`);
      }

      const collaboration = await response.json();
      this.emitEvent('collaboration_initiated', { collaboration });
      
      return {
        ...collaboration,
        startedAt: new Date(collaboration.startedAt)
      };
    } catch (error) {
      console.error('Initiate collaboration error:', error);
      throw error;
    }
  }

  async getCollaborationStatus(collaborationId: string): Promise<{
    id: string;
    status: 'initiated' | 'running' | 'completed' | 'failed';
    participants: Array<{
      agentId: string;
      role: 'initiator' | 'collaborator';
      status: 'active' | 'idle' | 'error';
      contribution: any;
    }>;
    messages: Array<{
      from: string;
      to: string | 'all';
      content: string;
      timestamp: Date;
      type: 'message' | 'result' | 'error';
    }>;
    result?: any;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/collaboration/${collaborationId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get collaboration status: ${response.status} ${response.statusText}`);
      }

      const collaboration = await response.json();
      
      // Transform timestamps
      collaboration.messages = collaboration.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      
      collaboration.startedAt = new Date(collaboration.startedAt);
      if (collaboration.completedAt) {
        collaboration.completedAt = new Date(collaboration.completedAt);
      }

      return collaboration;
    } catch (error) {
      console.error('Get collaboration status error:', error);
      throw error;
    }
  }

  // PRODUCTION: WebSocket Connection for Real-time Updates
  private initializeWebSocketConnection(): void {
    if (typeof window === 'undefined') return;

    const wsUrl = `${this.baseUrl.replace('http', 'ws')}/api/agents/ws`;
    
    try {
      this.wsConnection = new WebSocket(wsUrl);
      
      this.wsConnection.onopen = () => {
        console.log('Agent service WebSocket connected');
        
        // Send authentication
        this.wsConnection?.send(JSON.stringify({
          type: 'auth',
          token: this.getAuthToken(),
          organizationId: this.getOrganizationId()
        }));
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('Agent service WebSocket disconnected');
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          this.initializeWebSocketConnection();
        }, 5000);
      };

      this.wsConnection.onerror = (error) => {
        console.error('Agent service WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
    }
  }

  private handleWebSocketMessage(data: any): void {
    // Emit event to all subscribers
    this.eventSubscribers.forEach(callback => callback(data));
  }

  private emitEvent(type: string, payload: any): void {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({ type, payload }));
    }
  }

  // PRODUCTION: Event Subscription
  subscribeToEvents(callback: (event: any) => void): () => void {
    this.eventSubscribers.add(callback);
    
    return () => {
      this.eventSubscribers.delete(callback);
    };
  }

  // Helper Methods
  private validateExecutionResponse(execution: any): boolean {
    return (
      execution &&
      typeof execution.id === 'string' &&
      typeof execution.agentId === 'string' &&
      typeof execution.status === 'string' &&
      execution.startedAt &&
      execution.metadata &&
      typeof execution.metadata.userId === 'string' &&
      typeof execution.metadata.organizationId === 'string'
    );
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synapseai_token') || 
             localStorage.getItem('accessToken') || 
             sessionStorage.getItem('authToken') || '';
    }
    return process.env.SYNAPSEAI_API_TOKEN || '';
  }

  private getOrganizationId(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('organizationId') || 
             sessionStorage.getItem('currentOrganization') || '';
    }
    return process.env.SYNAPSEAI_ORG_ID || '';
  }

  private clearAgentCache(agentId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(agentId));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.eventSubscribers.clear();
    this.cache.clear();
  }
}

export const agentService = new AgentService();