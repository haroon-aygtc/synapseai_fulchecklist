import { toast } from '@/components/ui/use-toast';

export interface WorkflowNode {
  id: string;
  type: 'start' | 'end' | 'agent' | 'tool' | 'condition' | 'loop' | 'human-input' | 'webhook' | 'api' | 'database';
  name: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  inputs: string[];
  outputs: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  label?: string;
}

export interface WorkflowData {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggers: {
    type: 'manual' | 'schedule' | 'webhook' | 'event';
    config: Record<string, any>;
  }[];
  settings: {
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffStrategy: 'linear' | 'exponential';
    };
    errorHandling: 'stop' | 'continue' | 'retry';
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  organizationId: string;
  tags: string[];
  category: string;
  isPublic: boolean;
  usage: {
    executions: number;
    successRate: number;
    avgDuration: number;
    lastExecuted?: string;
  };
  cost: {
    total: number;
    perExecution: number;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  nodeExecutions: {
    nodeId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt: string;
    completedAt?: string;
    duration?: number;
    input?: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
  }[];
  cost: number;
  triggeredBy: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  popularity: number;
  rating: number;
  installs: number;
  author: string;
  thumbnail?: string;
  template: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    settings: WorkflowData['settings'];
    triggers: WorkflowData['triggers'];
  };
}

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  triggers?: WorkflowData['triggers'];
  settings?: Partial<WorkflowData['settings']>;
  tags?: string[];
  category?: string;
  isPublic?: boolean;
}

export interface UpdateWorkflowRequest extends Partial<CreateWorkflowRequest> {
  status?: WorkflowData['status'];
  version?: string;
}

export interface GetWorkflowsQuery {
  organizationId: string;
  search?: string;
  status?: WorkflowData['status'];
  category?: string;
  tags?: string[];
  createdBy?: string;
  limit?: number;
  offset?: number;
  includeNodes?: boolean;
  includeExecutions?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExecuteWorkflowRequest {
  input?: Record<string, any>;
  context?: Record<string, any>;
  triggeredBy: string;
  priority?: 'low' | 'normal' | 'high';
}

class WorkflowApiService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  private getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    const organizationId = localStorage.getItem('currentOrganizationId');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Organization-Id': organizationId || ''
    };
  }

  async getWorkflows(query: GetWorkflowsQuery): Promise<{ workflows: WorkflowData[]; total: number }> {
    try {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        workflows: data.workflows || [],
        total: data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<WorkflowData> {
    try {
      const response = await fetch(`${this.baseUrl}/${workflowId}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch workflow:', error);
      throw error;
    }
  }

  async createWorkflow(workflowData: CreateWorkflowRequest): Promise<WorkflowData> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(workflowData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create workflow: ${response.statusText}`);
      }

      const workflow = await response.json();
      toast({
        title: 'Workflow Created',
        description: `${workflow.name} has been created successfully.`
      });
      
      return workflow;
    } catch (error) {
      console.error('Failed to create workflow:', error);
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create workflow',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async updateWorkflow(workflowId: string, workflowData: UpdateWorkflowRequest): Promise<WorkflowData> {
    try {
      const response = await fetch(`${this.baseUrl}/${workflowId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(workflowData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update workflow: ${response.statusText}`);
      }

      const workflow = await response.json();
      toast({
        title: 'Workflow Updated',
        description: `${workflow.name} has been updated successfully.`
      });
      
      return workflow;
    } catch (error) {
      console.error('Failed to update workflow:', error);
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update workflow',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${workflowId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete workflow: ${response.statusText}`);
      }

      toast({
        title: 'Workflow Deleted',
        description: 'Workflow has been deleted successfully.'
      });
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      toast({
        title: 'Deletion Failed',
        description: error instanceof Error ? error.message : 'Failed to delete workflow',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async executeWorkflow(workflowId: string, request: ExecuteWorkflowRequest): Promise<WorkflowExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/${workflowId}/execute`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to execute workflow: ${response.statusText}`);
      }

      const execution = await response.json();
      toast({
        title: 'Workflow Execution Started',
        description: `Execution ${execution.id} has been started.`
      });
      
      return execution;
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      toast({
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Failed to execute workflow',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async getWorkflowExecutions(workflowId: string, limit: number = 50): Promise<{ executions: WorkflowExecution[]; total: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/${workflowId}/executions?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch executions: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        executions: data.executions || [],
        total: data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch executions:', error);
      throw error;
    }
  }

  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/executions/${executionId}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch execution: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch execution:', error);
      throw error;
    }
  }

  async cancelWorkflowExecution(executionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/executions/${executionId}/cancel`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to cancel execution: ${response.statusText}`);
      }

      toast({
        title: 'Execution Cancelled',
        description: 'Workflow execution has been cancelled.'
      });
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      toast({
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel execution',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async getTemplates(): Promise<{ templates: WorkflowTemplate[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/templates`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        templates: data.templates || []
      };
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      throw error;
    }
  }

  async createFromTemplate(templateId: string, customizations: Partial<CreateWorkflowRequest>): Promise<WorkflowData> {
    try {
      const response = await fetch(`${this.baseUrl}/templates/${templateId}/create`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(customizations)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create from template: ${response.statusText}`);
      }

      const workflow = await response.json();
      toast({
        title: 'Workflow Created from Template',
        description: `${workflow.name} has been created successfully.`
      });
      
      return workflow;
    } catch (error) {
      console.error('Failed to create from template:', error);
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create workflow from template',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async saveAsTemplate(workflowId: string, templateData: { name: string; description: string; category: string }): Promise<WorkflowTemplate> {
    try {
      const response = await fetch(`${this.baseUrl}/${workflowId}/save-as-template`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(templateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to save as template: ${response.statusText}`);
      }

      const template = await response.json();
      toast({
        title: 'Template Saved',
        description: `${template.name} template has been saved successfully.`
      });
      
      return template;
    } catch (error) {
      console.error('Failed to save as template:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save workflow as template',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async validateWorkflow(workflowData: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(workflowData)
      });

      if (!response.ok) {
        throw new Error(`Failed to validate workflow: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to validate workflow:', error);
      throw error;
    }
  }

  async duplicateWorkflow(workflowId: string, newName?: string): Promise<WorkflowData> {
    try {
      const response = await fetch(`${this.baseUrl}/${workflowId}/duplicate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ name: newName })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to duplicate workflow: ${response.statusText}`);
      }

      const workflow = await response.json();
      toast({
        title: 'Workflow Duplicated',
        description: `${workflow.name} has been created as a copy.`
      });
      
      return workflow;
    } catch (error) {
      console.error('Failed to duplicate workflow:', error);
      toast({
        title: 'Duplication Failed',
        description: error instanceof Error ? error.message : 'Failed to duplicate workflow',
        variant: 'destructive'
      });
      throw error;
    }
  }
}

export const workflowApiService = new WorkflowApiService();
export default workflowApiService;