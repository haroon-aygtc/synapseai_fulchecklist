import { z } from 'zod';

// PRODUCTION: Real Workflow Types and Interfaces
export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggers: WorkflowTrigger[];
  variables: Record<string, any>;
  settings: WorkflowSettings;
  tags: string[];
  organizationId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isTemplate: boolean;
  metadata: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
    lastExecuted: Date | null;
    complexity: number;
    estimatedCost: number;
  };
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'tool' | 'hybrid' | 'condition' | 'loop' | 'transformer' | 'human_input' | 'webhook' | 'email' | 'database';
  name: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  inputs: Array<{ id: string; name: string; type: string; required: boolean }>;
  outputs: Array<{ id: string; name: string; type: string }>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
  label?: string;
}

export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'scheduled' | 'webhook' | 'event' | 'api';
  config: Record<string, any>;
  isActive: boolean;
}

export interface WorkflowSettings {
  executionTimeout: number;
  maxConcurrentExecutions: number;
  retryOnFailure: boolean;
  maxRetries: number;
  errorHandling: 'stop' | 'continue' | 'retry';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    channels: string[];
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  input: any;
  output?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  steps: WorkflowExecutionStep[];
  metadata: {
    userId: string;
    organizationId: string;
    trigger: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    cost: number;
    resourceUsage: {
      memoryUsage: number;
      cpuTime: number;
      networkCalls: number;
    };
  };
}

export interface WorkflowExecutionStep {
  id: string;
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: any;
  output?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  retryCount: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  workflow: Partial<Workflow>;
  usage: {
    installs: number;
    rating: number;
    reviews: number;
  };
  author: {
    name: string;
    avatar?: string;
    verified: boolean;
  };
}

export interface WorkflowAnalytics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
  totalCost: number;
  executionTrend: Array<{
    date: string;
    executions: number;
    successRate: number;
    avgDuration: number;
    cost: number;
  }>;
  nodePerformance: Array<{
    nodeId: string;
    nodeName: string;
    executions: number;
    avgDuration: number;
    errorRate: number;
  }>;
  errorAnalysis: Array<{
    error: string;
    count: number;
    percentage: number;
    nodeId?: string;
  }>;
  costBreakdown: Array<{
    category: string;
    cost: number;
    percentage: number;
  }>;
}

export interface WorkflowStats {
  totalNodes: number;
  totalEdges: number;
  complexity: number;
  estimatedExecutionTime: number;
  estimatedCost: number;
  lastModified: Date;
  version: number;
}

// PRODUCTION: Real Workflow Service Implementation
export class WorkflowService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private wsConnection: WebSocket | null = null;
  private eventSubscribers = new Set<(event: any) => void>();
  private activeExecutions = new Map<string, WorkflowExecution>();

  constructor() {
    this.initializeWebSocketConnection();
  }

  // PRODUCTION: Real Workflow CRUD Operations
  async getWorkflows(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tags?: string[];
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ workflows: Workflow[]; total: number; page: number; limit: number }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));
      if (params?.category) searchParams.set('category', params.category);
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const response = await fetch(`${this.baseUrl}/api/workflows?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform timestamps
      data.workflows = data.workflows.map((workflow: any) => ({
        ...workflow,
        createdAt: new Date(workflow.createdAt),
        updatedAt: new Date(workflow.updatedAt),
        metadata: {
          ...workflow.metadata,
          lastExecuted: workflow.metadata.lastExecuted ? new Date(workflow.metadata.lastExecuted) : null
        }
      }));

      return data;
    } catch (error) {
      console.error('Get workflows error:', error);
      throw error;
    }
  }

  async getWorkflow(id: string): Promise<Workflow> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Workflow not found');
        }
        throw new Error(`Failed to fetch workflow: ${response.status} ${response.statusText}`);
      }

      const workflow = await response.json();
      
      // Transform timestamps
      workflow.createdAt = new Date(workflow.createdAt);
      workflow.updatedAt = new Date(workflow.updatedAt);
      if (workflow.metadata.lastExecuted) {
        workflow.metadata.lastExecuted = new Date(workflow.metadata.lastExecuted);
      }

      return workflow;
    } catch (error) {
      console.error('Get workflow error:', error);
      throw error;
    }
  }

  async createWorkflow(data: Partial<Workflow>): Promise<Workflow> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows`, {
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
        throw new Error(errorData.message || `Failed to create workflow: ${response.status} ${response.statusText}`);
      }

      const workflow = await response.json();
      
      // Transform timestamps
      workflow.createdAt = new Date(workflow.createdAt);
      workflow.updatedAt = new Date(workflow.updatedAt);
      
      // Emit real-time event
      this.emitEvent('workflow_created', { workflow });
      
      return workflow;
    } catch (error) {
      console.error('Create workflow error:', error);
      throw error;
    }
  }

  async updateWorkflow(id: string, data: Partial<Workflow>): Promise<Workflow> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}`, {
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
        throw new Error(errorData.message || `Failed to update workflow: ${response.status} ${response.statusText}`);
      }

      const workflow = await response.json();
      
      // Transform timestamps
      workflow.createdAt = new Date(workflow.createdAt);
      workflow.updatedAt = new Date(workflow.updatedAt);
      
      // Clear cache and emit event
      this.clearWorkflowCache(id);
      this.emitEvent('workflow_updated', { workflow });
      
      return workflow;
    } catch (error) {
      console.error('Update workflow error:', error);
      throw error;
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete workflow: ${response.status} ${response.statusText}`);
      }

      // Clear cache and emit event
      this.clearWorkflowCache(id);
      this.emitEvent('workflow_deleted', { workflowId: id });
    } catch (error) {
      console.error('Delete workflow error:', error);
      throw error;
    }
  }

  async cloneWorkflow(id: string, name?: string): Promise<Workflow> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        throw new Error(`Failed to clone workflow: ${response.status} ${response.statusText}`);
      }

      const workflow = await response.json();
      workflow.createdAt = new Date(workflow.createdAt);
      workflow.updatedAt = new Date(workflow.updatedAt);
      
      this.emitEvent('workflow_created', { workflow });
      
      return workflow;
    } catch (error) {
      console.error('Clone workflow error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Validation
  async validateWorkflow(workflow: Partial<Workflow>): Promise<{
    valid: boolean;
    errors: Array<{
      type: 'cycle' | 'disconnected' | 'missing_config' | 'invalid_node' | 'missing_trigger';
      message: string;
      nodeId?: string;
    }>;
    warnings: Array<{
      type: string;
      message: string;
      nodeId?: string;
    }>;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(workflow)
      });

      if (!response.ok) {
        throw new Error(`Workflow validation failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Validate workflow error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Execution
  async executeWorkflow(id: string, input?: any, options?: {
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timeout?: number;
    variables?: Record<string, any>;
  }): Promise<WorkflowExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ 
          input: input || {},
          options: options || {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to execute workflow: ${response.status} ${response.statusText}`);
      }

      const execution = await response.json();
      
      // Transform timestamps
      execution.startedAt = new Date(execution.startedAt);
      if (execution.completedAt) {
        execution.completedAt = new Date(execution.completedAt);
      }
      
      execution.steps = execution.steps.map((step: any) => ({
        ...step,
        startedAt: new Date(step.startedAt),
        completedAt: step.completedAt ? new Date(step.completedAt) : undefined
      }));

      // Store active execution
      this.activeExecutions.set(execution.id, execution);
      
      // Emit real-time event
      this.emitEvent('workflow_execution_started', { execution });
      
      return execution;
    } catch (error) {
      console.error('Execute workflow error:', error);
      throw error;
    }
  }

  async stopWorkflowExecution(executionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/executions/${executionId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to stop workflow execution: ${response.status} ${response.statusText}`);
      }

      // Remove from active executions
      this.activeExecutions.delete(executionId);
      
      // Emit real-time event
      this.emitEvent('workflow_execution_stopped', { executionId });
    } catch (error) {
      console.error('Stop workflow execution error:', error);
      throw error;
    }
  }

  async pauseWorkflowExecution(executionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/executions/${executionId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to pause workflow execution: ${response.status} ${response.statusText}`);
      }

      this.emitEvent('workflow_execution_paused', { executionId });
    } catch (error) {
      console.error('Pause workflow execution error:', error);
      throw error;
    }
  }

  async resumeWorkflowExecution(executionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/executions/${executionId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to resume workflow execution: ${response.status} ${response.statusText}`);
      }

      this.emitEvent('workflow_execution_resumed', { executionId });
    } catch (error) {
      console.error('Resume workflow execution error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Executions Management
  async getWorkflowExecutions(id: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    executions: WorkflowExecution[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.status) searchParams.set('status', params.status);
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom.toISOString());
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo.toISOString());

      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/executions?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow executions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform timestamps
      data.executions = data.executions.map((execution: any) => ({
        ...execution,
        startedAt: new Date(execution.startedAt),
        completedAt: execution.completedAt ? new Date(execution.completedAt) : undefined,
        steps: execution.steps.map((step: any) => ({
          ...step,
          startedAt: new Date(step.startedAt),
          completedAt: step.completedAt ? new Date(step.completedAt) : undefined
        }))
      }));

      return data;
    } catch (error) {
      console.error('Get workflow executions error:', error);
      throw error;
    }
  }

  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/executions/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Workflow execution not found');
        }
        throw new Error(`Failed to fetch workflow execution: ${response.status} ${response.statusText}`);
      }

      const execution = await response.json();
      
      // Transform timestamps
      execution.startedAt = new Date(execution.startedAt);
      if (execution.completedAt) {
        execution.completedAt = new Date(execution.completedAt);
      }
      
      execution.steps = execution.steps.map((step: any) => ({
        ...step,
        startedAt: new Date(step.startedAt),
        completedAt: step.completedAt ? new Date(step.completedAt) : undefined
      }));

      return execution;
    } catch (error) {
      console.error('Get workflow execution error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Analytics
  async getWorkflowAnalytics(id: string, timeRange?: string): Promise<WorkflowAnalytics> {
    try {
      const searchParams = new URLSearchParams();
      if (timeRange) searchParams.set('timeRange', timeRange);

      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/analytics?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow analytics: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get workflow analytics error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Settings Management
  async updateWorkflowSettings(
    id: string, 
    settings: Partial<WorkflowSettings>
  ): Promise<Workflow> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`Failed to update workflow settings: ${response.status} ${response.statusText}`);
      }

      const workflow = await response.json();
      workflow.createdAt = new Date(workflow.createdAt);
      workflow.updatedAt = new Date(workflow.updatedAt);
      
      this.clearWorkflowCache(id);
      this.emitEvent('workflow_settings_updated', { workflow });
      
      return workflow;
    } catch (error) {
      console.error('Update workflow settings error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Templates
  async getWorkflowTemplates(params?: {
    category?: string;
    difficulty?: string;
    tags?: string[];
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<WorkflowTemplate[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set('category', params.category);
      if (params?.difficulty) searchParams.set('difficulty', params.difficulty);
      if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));
      if (params?.search) searchParams.set('search', params.search);
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const response = await fetch(`${this.baseUrl}/api/workflows/templates?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow templates: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get workflow templates error:', error);
      throw error;
    }
  }

  async createFromTemplate(templateId: string, data: {
    name: string;
    description?: string;
    customizations?: Record<string, any>;
  }): Promise<Workflow> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/templates/${templateId}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to create workflow from template: ${response.status} ${response.statusText}`);
      }

      const workflow = await response.json();
      workflow.createdAt = new Date(workflow.createdAt);
      workflow.updatedAt = new Date(workflow.updatedAt);
      
      this.emitEvent('workflow_created', { workflow });
      
      return workflow;
    } catch (error) {
      console.error('Create from template error:', error);
      throw error;
    }
  }

  async saveAsTemplate(id: string, data: {
    name: string;
    description: string;
    category: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }): Promise<WorkflowTemplate> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/save-as-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to save workflow as template: ${response.status} ${response.statusText}`);
      }

      const template = await response.json();
      this.emitEvent('workflow_template_created', { template });
      
      return template;
    } catch (error) {
      console.error('Save as template error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Import/Export
  async exportWorkflow(id: string, format: 'json' | 'yaml' = 'json'): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to export workflow: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export workflow error:', error);
      throw error;
    }
  }

  async importWorkflow(file: File): Promise<Workflow> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/api/workflows/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to import workflow: ${response.status} ${response.statusText}`);
      }

      const workflow = await response.json();
      workflow.createdAt = new Date(workflow.createdAt);
      workflow.updatedAt = new Date(workflow.updatedAt);
      
      this.emitEvent('workflow_created', { workflow });
      
      return workflow;
    } catch (error) {
      console.error('Import workflow error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Logs
  async getWorkflowLogs(id: string, params?: {
    page?: number;
    limit?: number;
    level?: string;
    executionId?: string;
    nodeId?: string;
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
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.level) searchParams.set('level', params.level);
      if (params?.executionId) searchParams.set('executionId', params.executionId);
      if (params?.nodeId) searchParams.set('nodeId', params.nodeId);

      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/logs?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow logs: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform timestamps
      data.logs = data.logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));

      return data;
    } catch (error) {
      console.error('Get workflow logs error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Bulk Operations
  async bulkDelete(ids: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/bulk-delete`, {
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

      // Clear cache for all deleted workflows
      ids.forEach(id => this.clearWorkflowCache(id));
      this.emitEvent('workflows_bulk_deleted', { ids });
    } catch (error) {
      console.error('Bulk delete error:', error);
      throw error;
    }
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/bulk-update-status`, {
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

      // Clear cache for all updated workflows
      ids.forEach(id => this.clearWorkflowCache(id));
      this.emitEvent('workflows_bulk_updated', { ids, status });
    } catch (error) {
      console.error('Bulk update status error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Categories
  async getWorkflowCategories(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/categories`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow categories: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get workflow categories error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Scheduling
  async scheduleWorkflow(id: string, schedule: {
    type: 'cron' | 'interval';
    expression: string;
    timezone?: string;
    enabled: boolean;
    input?: any;
    variables?: Record<string, any>;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(schedule)
      });

      if (!response.ok) {
        throw new Error(`Failed to schedule workflow: ${response.status} ${response.statusText}`);
      }

      this.emitEvent('workflow_scheduled', { workflowId: id, schedule });
    } catch (error) {
      console.error('Schedule workflow error:', error);
      throw error;
    }
  }

  async getWorkflowSchedule(id: string): Promise<{
    id: string;
    type: 'cron' | 'interval';
    expression: string;
    timezone: string;
    enabled: boolean;
    nextRun?: Date;
    lastRun?: Date;
    input?: any;
    variables?: Record<string, any>;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/schedule`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch workflow schedule: ${response.status} ${response.statusText}`);
      }

      const schedule = await response.json();
      
      // Transform timestamps
      if (schedule.nextRun) {
        schedule.nextRun = new Date(schedule.nextRun);
      }
      if (schedule.lastRun) {
        schedule.lastRun = new Date(schedule.lastRun);
      }

      return schedule;
    } catch (error) {
      console.error('Get workflow schedule error:', error);
      throw error;
    }
  }

  async updateWorkflowSchedule(id: string, schedule: {
    type: 'cron' | 'interval';
    expression: string;
    timezone?: string;
    enabled: boolean;
    input?: any;
    variables?: Record<string, any>;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/schedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify(schedule)
      });

      if (!response.ok) {
        throw new Error(`Failed to update workflow schedule: ${response.status} ${response.statusText}`);
      }

      this.emitEvent('workflow_schedule_updated', { workflowId: id, schedule });
    } catch (error) {
      console.error('Update workflow schedule error:', error);
      throw error;
    }
  }

  async deleteWorkflowSchedule(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/schedule`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete workflow schedule: ${response.status} ${response.statusText}`);
      }

      this.emitEvent('workflow_schedule_deleted', { workflowId: id });
    } catch (error) {
      console.error('Delete workflow schedule error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Workflow Statistics
  async getWorkflowStats(id: string): Promise<WorkflowStats> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/stats`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow stats: ${response.status} ${response.statusText}`);
      }

      const stats = await response.json();
      
      // Transform timestamps
      stats.lastModified = new Date(stats.lastModified);

      return stats;
    } catch (error) {
      console.error('Get workflow stats error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Analytics Export
  async exportAnalytics(id: string, timeRange: string, format: 'csv' | 'pdf' | 'json' = 'csv'): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${id}/analytics/export?timeRange=${timeRange}&format=${format}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to export analytics: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export analytics error:', error);
      throw error;
    }
  }

  // PRODUCTION: Real Human Input Management
  async provideHumanInput(executionId: string, nodeId: string, input: any): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/executions/${executionId}/human-input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ nodeId, input })
      });

      if (!response.ok) {
        throw new Error(`Failed to provide human input: ${response.status} ${response.statusText}`);
      }

      this.emitEvent('human_input_provided', { executionId, nodeId, input });
    } catch (error) {
      console.error('Provide human input error:', error);
      throw error;
    }
  }

  async getHumanInputRequests(params?: {
    status?: 'pending' | 'completed' | 'expired';
    assignedTo?: string;
    workflowId?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    executionId: string;
    workflowId: string;
    nodeId: string;
    prompt: string;
    context: any;
    status: 'pending' | 'completed' | 'expired';
    assignedTo?: string;
    createdAt: Date;
    expiresAt?: Date;
    completedAt?: Date;
    response?: any;
  }>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.assignedTo) searchParams.set('assignedTo', params.assignedTo);
      if (params?.workflowId) searchParams.set('workflowId', params.workflowId);
      if (params?.limit) searchParams.set('limit', params.limit.toString());

      const response = await fetch(`${this.baseUrl}/api/workflows/human-input-requests?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch human input requests: ${response.status} ${response.statusText}`);
      }

      const requests = await response.json();
      
      // Transform timestamps
      return requests.map((request: any) => ({
        ...request,
        createdAt: new Date(request.createdAt),
        expiresAt: request.expiresAt ? new Date(request.expiresAt) : undefined,
        completedAt: request.completedAt ? new Date(request.completedAt) : undefined
      }));
    } catch (error) {
      console.error('Get human input requests error:', error);
      throw error;
    }
  }

  // PRODUCTION: WebSocket Connection for Real-time Updates
  private initializeWebSocketConnection(): void {
    if (typeof window === 'undefined') return;

    const wsUrl = `${this.baseUrl.replace('http', 'ws')}/api/workflows/ws`;
    
    try {
      this.wsConnection = new WebSocket(wsUrl);
      
      this.wsConnection.onopen = () => {
        console.log('Workflow service WebSocket connected');
        
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
        console.log('Workflow service WebSocket disconnected');
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          this.initializeWebSocketConnection();
        }, 5000);
      };

      this.wsConnection.onerror = (error) => {
        console.error('Workflow service WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
    }
  }

  private handleWebSocketMessage(data: any): void {
    // Update active executions if relevant
    if (data.type === 'workflow_execution_updated' && data.payload.execution) {
      const execution = data.payload.execution;
      execution.startedAt = new Date(execution.startedAt);
      if (execution.completedAt) {
        execution.completedAt = new Date(execution.completedAt);
      }
      this.activeExecutions.set(execution.id, execution);
    }

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

  private clearWorkflowCache(workflowId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(workflowId));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.eventSubscribers.clear();
    this.cache.clear();
    this.activeExecutions.clear();
  }
}

export const workflowService = new WorkflowService();