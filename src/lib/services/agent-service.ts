import { Agent, AgentConfiguration, AgentAnalytics } from '../types';

class AgentService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  private providerService: ProvidersService;
  private realTimeMemoryManager: RealTimeMemoryManager;
  private collaborationEngine: CollaborationEngine;

  constructor() {
    this.providerService = new ProvidersService();
    this.realTimeMemoryManager = new RealTimeMemoryManager();
    this.collaborationEngine = new CollaborationEngine();
  }

  // PRODUCTION FIX: Real Agent Execution with Provider Integration
  async executeWithProvider(
    agentId: string,
    input: any,
    options: {
      timeout?: number;
      retryPolicy?: any;
      streaming?: boolean;
      preferredProvider?: string;
    } = {}
  ): Promise<any> {
    try {
      // Get agent configuration
      const agent = await this.getAgentConfiguration(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Prepare enhanced context with memory
      const memory = await this.realTimeMemoryManager.getAgentMemory(agentId);
      const context = await this.prepareEnhancedContext(agent, input, memory);

      // Execute with smart provider routing
      const result = await this.providerService.executeWithSmartRouting(
        agent.organizationId,
        {
          messages: context.messages,
          model: agent.model,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          tools: agent.tools.length > 0 ? await this.getAgentTools(agent.tools) : undefined,
          stream: options.streaming
        },
        {
          strategy: 'balanced',
          preferredProvider: options.preferredProvider,
          maxRetries: options.retryPolicy?.maxRetries || 3,
          timeout: options.timeout || 30000
        }
      );

      // Update memory with interaction
      await this.realTimeMemoryManager.updateMemory(agentId, {
        input,
        output: result.content,
        metadata: result.metadata
      });

      return {
        content: result.content,
        usage: result.usage,
        provider: result.provider,
        metadata: {
          ...result.metadata,
          agentId,
          memoryUpdated: true
        }
      };

    } catch (error) {
      throw new Error(`Agent execution failed: ${error.message}`);
    }
  }

  // PRODUCTION FIX: Real Agent Configuration Retrieval
  private async getAgentConfiguration(agentId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get agent configuration: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to retrieve agent configuration: ${error.message}`);
    }
  }

  // PRODUCTION FIX: Secure Token Management
  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synapseai_token') || '';
    }
    return process.env.SYNAPSEAI_API_TOKEN || '';
  }

  // Enhanced Context Preparation with Real Memory
  private async prepareEnhancedContext(agent: any, input: any, memory: any): Promise<any> {
    const messages = [];

    // System prompt with enhanced capabilities
    messages.push({
      role: 'system',
      content: `${agent.systemPrompt || 'You are a helpful AI assistant.'}

Additional Context:
- Agent ID: ${agent.id}
- Agent Type: ${agent.type}
- Available Tools: ${agent.tools.join(', ')}
- Memory Context: ${JSON.stringify(memory.relevantContext)}
- Current Time: ${new Date().toISOString()}

Instructions:
- Use your tools when appropriate
- Consider the conversation history and context
- Provide detailed, helpful responses
- If using tools, explain your reasoning`
    });

    // Add relevant conversation history
    if (memory.conversationHistory && memory.conversationHistory.length > 0) {
      const recentHistory = memory.conversationHistory.slice(-10);
      messages.push(...recentHistory);
    }

    // Add current user input
    messages.push({
      role: 'user',
      content: typeof input === 'string' ? input : JSON.stringify(input)
    });

    return { messages };
  }

  // Real Tool Integration
  private async getAgentTools(toolIds: string[]): Promise<any[]> {
    if (toolIds.length === 0) return [];

    try {
      const tools = [];
      for (const toolId of toolIds) {
        const response = await fetch(`${this.baseUrl}/tools/${toolId}`, {
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const tool = await response.json();
          tools.push({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            }
          });
        }
      }
      return tools;
    } catch (error) {
      console.warn('Failed to load agent tools:', error.message);
      return [];
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getAgents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
    tags?: string[];
  }): Promise<{ agents: Agent[]; total: number; page: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));

    return this.request(`/agents?${searchParams.toString()}`);
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request(`/agents/${id}`);
  }

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
    return this.request(`/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id: string): Promise<void> {
    await this.request(`/agents/${id}`, { method: 'DELETE' });
  }

  async cloneAgent(id: string, name?: string): Promise<Agent> {
    return this.request(`/agents/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async testAgent(id: string, message: string): Promise<{
    response: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
    cost: number;
  }> {
    return this.request(`/agents/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getAgentSessions(id: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    sessions: Array<{
      id: string;
      startedAt: Date;
      endedAt?: Date;
      messageCount: number;
      status: string;
    }>;
    total: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    return this.request(`/agents/${id}/sessions?${searchParams.toString()}`);
  }

  async getAgentAnalytics(id: string, timeRange?: string): Promise<AgentAnalytics> {
    const searchParams = new URLSearchParams();
    if (timeRange) searchParams.set('timeRange', timeRange);

    return this.request(`/agents/${id}/analytics?${searchParams.toString()}`);
  }

  async updateAgentConfiguration(
    id: string, 
    configuration: Partial<AgentConfiguration>
  ): Promise<Agent> {
    return this.request(`/agents/${id}/configuration`, {
      method: 'PATCH',
      body: JSON.stringify(configuration),
    });
  }

  async getAgentTemplates(category?: string): Promise<Agent[]> {
    const searchParams = new URLSearchParams();
    if (category) searchParams.set('category', category);

    return this.request(`/agents/templates?${searchParams.toString()}`);
  }

  async createFromTemplate(templateId: string, data: {
    name: string;
    description?: string;
    configuration?: Partial<AgentConfiguration>;
  }): Promise<Agent> {
    return this.request(`/agents/templates/${templateId}/create`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exportAgent(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/agents/${id}/export`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('synapseai_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  async importAgent(file: File): Promise<Agent> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/agents/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('synapseai_token')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Import failed');
    }

    return response.json();
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.request('/agents/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    await this.request('/agents/bulk-update-status', {
      method: 'POST',
      body: JSON.stringify({ ids, status }),
    });
  }
}

// PRODUCTION FIX: Real-Time Memory Manager with Persistent Storage
class RealTimeMemoryManager {
  private memoryCache = new Map<string, any>();
  private memoryUpdateQueue: Array<{ agentId: string; update: any }> = [];
  private persistenceEnabled = true;

  async getAgentMemory(agentId: string): Promise<any> {
    // Check cache first
    if (this.memoryCache.has(agentId)) {
      return this.memoryCache.get(agentId);
    }

    // Load from persistent storage
    try {
      const response = await fetch(`/api/agents/${agentId}/memory`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        const memory = await response.json();
        this.memoryCache.set(agentId, memory);
        return memory;
      }
    } catch (error) {
      console.warn('Failed to load agent memory:', error.message);
    }

    // Return default memory structure
    const defaultMemory = {
      conversationHistory: [],
      semanticMemory: [],
      episodicMemory: [],
      relevantContext: {}
    };
    
    this.memoryCache.set(agentId, defaultMemory);
    return defaultMemory;
  }

  async updateMemory(agentId: string, interaction: any): Promise<void> {
    const memory = await this.getAgentMemory(agentId);

    // Update conversation history
    memory.conversationHistory.push(
      {
        role: 'user',
        content: interaction.input,
        timestamp: new Date()
      },
      {
        role: 'assistant',
        content: interaction.output,
        timestamp: new Date()
      }
    );

    // Limit history size
    if (memory.conversationHistory.length > 50) {
      memory.conversationHistory = memory.conversationHistory.slice(-50);
    }

    // Update cache
    this.memoryCache.set(agentId, memory);

    // Queue for persistent storage
    if (this.persistenceEnabled) {
      this.memoryUpdateQueue.push({ agentId, update: interaction });
      this.processMemoryUpdates();
    }
  }

  private async processMemoryUpdates(): Promise<void> {
    if (this.memoryUpdateQueue.length === 0) return;

    const updates = [...this.memoryUpdateQueue];
    this.memoryUpdateQueue.length = 0;

    try {
      await fetch('/api/agents/memory/batch-update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      });
    } catch (error) {
      console.warn('Failed to persist memory updates:', error.message);
      // Re-queue failed updates
      this.memoryUpdateQueue.unshift(...updates);
    }
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synapseai_token') || '';
    }
    return process.env.SYNAPSEAI_API_TOKEN || '';
  }
}

// PRODUCTION FIX: Enhanced Collaboration Engine
class CollaborationEngine {
  private activeCollaborations = new Map<string, any>();
  private collaborationPersistence = true;

  async initiateCollaboration(
    initiatorAgentId: string,
    collaboratorAgentIds: string[],
    task: string,
    strategy: string
  ): Promise<string> {
    const collaborationId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const collaboration = {
      id: collaborationId,
      initiator: initiatorAgentId,
      collaborators: collaboratorAgentIds,
      task,
      strategy,
      status: 'active',
      startedAt: new Date(),
      messages: [],
      results: new Map()
    };

    this.activeCollaborations.set(collaborationId, collaboration);

    // Persist collaboration if enabled
    if (this.collaborationPersistence) {
      try {
        await fetch('/api/agents/collaboration', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(collaboration)
        });
      } catch (error) {
        console.warn('Failed to persist collaboration:', error.message);
      }
    }

    // Notify all agents about the collaboration
    for (const agentId of [initiatorAgentId, ...collaboratorAgentIds]) {
      await this.notifyAgentOfCollaboration(agentId, collaboration);
    }

    return collaborationId;
  }

  private async notifyAgentOfCollaboration(agentId: string, collaboration: any): Promise<void> {
    try {
      await fetch('/api/agents/collaboration/notify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId,
          collaborationId: collaboration.id,
          task: collaboration.task,
          role: agentId === collaboration.initiator ? 'initiator' : 'collaborator'
        })
      });
    } catch (error) {
      console.warn('Failed to notify agent of collaboration:', error.message);
    }
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synapseai_token') || '';
    }
    return process.env.SYNAPSEAI_API_TOKEN || '';
  }
}

// PRODUCTION FIX: Real Provider Service Integration
class ProvidersService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async executeWithSmartRouting(
    organizationId: string,
    data: any,
    preferences: any = {}
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/providers/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          data,
          preferences
        })
      });

      if (!response.ok) {
        throw new Error(`Provider execution failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Smart routing execution failed: ${error.message}`);
    }
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('synapseai_token') || '';
    }
    return process.env.SYNAPSEAI_API_TOKEN || '';
  }
}

export const agentService = new AgentService();