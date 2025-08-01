import { Tool, ToolConfiguration, ToolUsage } from '../types';

class ToolService {
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

  async getTools(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
    tags?: string[];
  }): Promise<{ tools: Tool[]; total: number; page: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));

    return this.request(`/tools?${searchParams.toString()}`);
  }

  async getTool(id: string): Promise<Tool> {
    return this.request(`/tools/${id}`);
  }

  async createTool(data: Partial<Tool>): Promise<Tool> {
    return this.request('/tools', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTool(id: string, data: Partial<Tool>): Promise<Tool> {
    return this.request(`/tools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTool(id: string): Promise<void> {
    await this.request(`/tools/${id}`, { method: 'DELETE' });
  }

  async cloneTool(id: string, name?: string): Promise<Tool> {
    return this.request(`/tools/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async testTool(id: string, input: any): Promise<{
    output: any;
    executionTime: number;
    success: boolean;
    error?: string;
  }> {
    return this.request(`/tools/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  }

  async getToolUsage(id: string, timeRange?: string): Promise<ToolUsage> {
    const searchParams = new URLSearchParams();
    if (timeRange) searchParams.set('timeRange', timeRange);

    return this.request(`/tools/${id}/usage?${searchParams.toString()}`);
  }

  async updateToolConfiguration(
    id: string, 
    configuration: Partial<ToolConfiguration>
  ): Promise<Tool> {
    return this.request(`/tools/${id}/configuration`, {
      method: 'PATCH',
      body: JSON.stringify(configuration),
    });
  }

  async getToolTemplates(category?: string): Promise<Tool[]> {
    const searchParams = new URLSearchParams();
    if (category) searchParams.set('category', category);

    return this.request(`/tools/templates?${searchParams.toString()}`);
  }

  async createFromTemplate(templateId: string, data: {
    name: string;
    description?: string;
    configuration?: Partial<ToolConfiguration>;
  }): Promise<Tool> {
    return this.request(`/tools/templates/${templateId}/create`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async validateToolSchema(schema: any): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    return this.request('/tools/validate-schema', {
      method: 'POST',
      body: JSON.stringify({ schema }),
    });
  }

  async importFromOpenAPI(spec: any, name: string): Promise<Tool[]> {
    return this.request('/tools/import/openapi', {
      method: 'POST',
      body: JSON.stringify({ spec, name }),
    });
  }

  async importFromPostman(collection: any, name: string): Promise<Tool[]> {
    return this.request('/tools/import/postman', {
      method: 'POST',
      body: JSON.stringify({ collection, name }),
    });
  }

  async exportTool(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/tools/${id}/export`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('synapseai_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  async importTool(file: File): Promise<Tool> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/tools/import`, {
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

  async getToolCategories(): Promise<string[]> {
    return this.request('/tools/categories');
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.request('/tools/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    await this.request('/tools/bulk-update-status', {
      method: 'POST',
      body: JSON.stringify({ ids, status }),
    });
  }

  async getToolExecutionHistory(id: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    executions: Array<{
      id: string;
      executedAt: Date;
      input: any;
      output: any;
      success: boolean;
      executionTime: number;
      error?: string;
    }>;
    total: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    return this.request(`/tools/${id}/executions?${searchParams.toString()}`);
  }
}

export const toolService = new ToolService();