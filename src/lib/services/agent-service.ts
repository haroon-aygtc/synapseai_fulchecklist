import { Agent, AgentConfiguration, AgentAnalytics } from '../types';

class AgentService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('synapseai_token');
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

export const agentService = new AgentService();