import { 
  Workflow, 
  WorkflowExecution, 
  WorkflowTemplate, 
  WorkflowSettings,
  WorkflowAnalytics 
} from '../types';

class WorkflowService {
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

  async getWorkflows(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tags?: string[];
  }): Promise<{ workflows: Workflow[]; total: number; page: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));

    return this.request(`/workflows?${searchParams.toString()}`);
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request(`/workflows/${id}`);
  }

  async createWorkflow(data: Partial<Workflow>): Promise<Workflow> {
    return this.request('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(id: string, data: Partial<Workflow>): Promise<Workflow> {
    return this.request(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/workflows/${id}`, { method: 'DELETE' });
  }

  async cloneWorkflow(id: string, name?: string): Promise<Workflow> {
    return this.request(`/workflows/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async validateWorkflow(workflow: Partial<Workflow>): Promise<{
    valid: boolean;
    errors: Array<{
      type: 'cycle' | 'disconnected' | 'missing_config' | 'invalid_node';
      message: string;
      nodeId?: string;
    }>;
    warnings: Array<{
      type: string;
      message: string;
      nodeId?: string;
    }>;
  }> {
    return this.request('/workflows/validate', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async executeWorkflow(id: string, input?: any): Promise<WorkflowExecution> {
    return this.request(`/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  }

  async stopWorkflowExecution(executionId: string): Promise<void> {
    await this.request(`/workflows/executions/${executionId}/stop`, {
      method: 'POST',
    });
  }

  async getWorkflowExecutions(id: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    executions: WorkflowExecution[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);

    return this.request(`/workflows/${id}/executions?${searchParams.toString()}`);
  }

  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request(`/workflows/executions/${executionId}`);
  }

  async getWorkflowAnalytics(id: string, timeRange?: string): Promise<WorkflowAnalytics> {
    const searchParams = new URLSearchParams();
    if (timeRange) searchParams.set('timeRange', timeRange);

    return this.request(`/workflows/${id}/analytics?${searchParams.toString()}`);
  }

  async updateWorkflowSettings(
    id: string, 
    settings: Partial<WorkflowSettings>
  ): Promise<Workflow> {
    return this.request(`/workflows/${id}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async getWorkflowTemplates(params?: {
    category?: string;
    difficulty?: string;
    tags?: string[];
  }): Promise<WorkflowTemplate[]> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.difficulty) searchParams.set('difficulty', params.difficulty);
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));

    return this.request(`/workflows/templates?${searchParams.toString()}`);
  }

  async createFromTemplate(templateId: string, data: {
    name: string;
    description?: string;
    customizations?: Record<string, any>;
  }): Promise<Workflow> {
    return this.request(`/workflows/templates/${templateId}/create`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveAsTemplate(id: string, data: {
    name: string;
    description: string;
    category: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }): Promise<WorkflowTemplate> {
    return this.request(`/workflows/${id}/save-as-template`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exportWorkflow(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/workflows/${id}/export`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('synapseai_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  async importWorkflow(file: File): Promise<Workflow> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/workflows/import`, {
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

  async getWorkflowLogs(id: string, params?: {
    page?: number;
    limit?: number;
    level?: string;
  }): Promise<{
    logs: Array<{
      id: string;
      timestamp: Date;
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      nodeId?: string;
      executionId?: string;
      metadata?: Record<string, any>;
    }>;
    total: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.level) searchParams.set('level', params.level);

    return this.request(`/workflows/${id}/logs?${searchParams.toString()}`);
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await this.request('/workflows/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    await this.request('/workflows/bulk-update-status', {
      method: 'POST',
      body: JSON.stringify({ ids, status }),
    });
  }

  async getWorkflowCategories(): Promise<string[]> {
    return this.request('/workflows/categories');
  }

  async scheduleWorkflow(id: string, schedule: {
    type: 'cron' | 'interval';
    expression: string;
    timezone?: string;
    enabled: boolean;
  }): Promise<void> {
    await this.request(`/workflows/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  }

  async getWorkflowSchedule(id: string): Promise<{
    id: string;
    type: 'cron' | 'interval';
    expression: string;
    timezone: string;
    enabled: boolean;
    nextRun?: Date;
    lastRun?: Date;
  } | null> {
    return this.request(`/workflows/${id}/schedule`);
  }

  async updateWorkflowSchedule(id: string, schedule: {
    type: 'cron' | 'interval';
    expression: string;
    timezone?: string;
    enabled: boolean;
  }): Promise<void> {
    await this.request(`/workflows/${id}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify(schedule),
    });
  }

  async deleteWorkflowSchedule(id: string): Promise<void> {
    await this.request(`/workflows/${id}/schedule`, {
      method: 'DELETE',
    });
  }
}

export const workflowService = new WorkflowService();