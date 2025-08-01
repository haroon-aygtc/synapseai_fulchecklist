import { Tool, ToolType, ToolExecution, ToolUsage } from '../types';
import { z } from 'zod';

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  organizationId: string;
  metadata?: Record<string, any>;
}

export class ToolService {
  private baseUrl = '/api/tools';

  // Tool CRUD Operations
  async createTool(config: Partial<Tool>): Promise<Tool> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create tool: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getTool(id: string): Promise<Tool> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get tool: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateTool(id: string, updates: Partial<Tool>): Promise<Tool> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update tool: ${response.statusText}`);
    }
    
    return response.json();
  }

  async deleteTool(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete tool: ${response.statusText}`);
    }
  }

  async listTools(organizationId: string, filters?: any): Promise<Tool[]> {
    const params = new URLSearchParams({
      organizationId,
      ...filters
    });
    
    const response = await fetch(`${this.baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Execution
  async executeTool(
    toolId: string, 
    input: any, 
    context: ToolExecutionContext
  ): Promise<ToolExecution> {
    const response = await fetch(`${this.baseUrl}/${toolId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to execute tool: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getExecution(executionId: string): Promise<ToolExecution> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get execution: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getExecutionHistory(toolId: string, limit: number = 50): Promise<ToolExecution[]> {
    const response = await fetch(`${this.baseUrl}/${toolId}/executions?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get execution history: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Testing
  async testTool(toolId: string, input: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${toolId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to test tool: ${response.statusText}`);
    }
    
    return response.json();
  }

  async validateSchema(toolId: string, input: any): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await fetch(`${this.baseUrl}/${toolId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to validate schema: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Categories & Templates
  async getCategories(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/categories`);
    
    if (!response.ok) {
      throw new Error(`Failed to get categories: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getTemplates(category?: string): Promise<any[]> {
    const params = category ? `?category=${category}` : '';
    const response = await fetch(`${this.baseUrl}/templates${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get templates: ${response.statusText}`);
    }
    
    return response.json();
  }

  async createFromTemplate(templateId: string, config: any): Promise<Tool> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create tool from template: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Analytics
  async getUsageStats(toolId: string, period: string = '7d'): Promise<ToolUsage> {
    const response = await fetch(`${this.baseUrl}/${toolId}/usage?period=${period}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get usage stats: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getAnalytics(toolId: string, period: string = '7d'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${toolId}/analytics?period=${period}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get analytics: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Sharing & Permissions
  async shareTool(toolId: string, permissions: any): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${toolId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permissions)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to share tool: ${response.statusText}`);
    }
  }

  async getSharedTools(organizationId: string): Promise<Tool[]> {
    const response = await fetch(`${this.baseUrl}/shared?organizationId=${organizationId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get shared tools: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Import/Export
  async exportTool(toolId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${toolId}/export`);
    
    if (!response.ok) {
      throw new Error(`Failed to export tool: ${response.statusText}`);
    }
    
    return response.json();
  }

  async importTool(toolData: any): Promise<Tool> {
    const response = await fetch(`${this.baseUrl}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to import tool: ${response.statusText}`);
    }
    
    return response.json();
  }

  async importFromOpenAPI(openApiSpec: any, config?: any): Promise<Tool[]> {
    const response = await fetch(`${this.baseUrl}/import/openapi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: openApiSpec, config })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to import from OpenAPI: ${response.statusText}`);
    }
    
    return response.json();
  }

  async importFromPostman(postmanCollection: any, config?: any): Promise<Tool[]> {
    const response = await fetch(`${this.baseUrl}/import/postman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: postmanCollection, config })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to import from Postman: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Version Management
  async createVersion(toolId: string, changelog: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${toolId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changelog })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create version: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getVersions(toolId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${toolId}/versions`);
    
    if (!response.ok) {
      throw new Error(`Failed to get versions: ${response.statusText}`);
    }
    
    return response.json();
  }

  async rollbackToVersion(toolId: string, versionId: string): Promise<Tool> {
    const response = await fetch(`${this.baseUrl}/${toolId}/versions/${versionId}/rollback`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to rollback to version: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Authentication Management
  async updateAuthentication(toolId: string, auth: any): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${toolId}/auth`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auth)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update authentication: ${response.statusText}`);
    }
  }

  async testAuthentication(toolId: string): Promise<{ valid: boolean; error?: string }> {
    const response = await fetch(`${this.baseUrl}/${toolId}/auth/test`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to test authentication: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Tool Monitoring
  async getHealthStatus(toolId: string): Promise<{ status: string; lastCheck: Date; details?: any }> {
    const response = await fetch(`${this.baseUrl}/${toolId}/health`);
    
    if (!response.ok) {
      throw new Error(`Failed to get health status: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getErrorLogs(toolId: string, limit: number = 50): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${toolId}/errors?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get error logs: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Batch Operations
  async batchExecute(executions: Array<{ toolId: string; input: any; context: ToolExecutionContext }>): Promise<ToolExecution[]> {
    const response = await fetch(`${this.baseUrl}/batch/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executions })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to batch execute: ${response.statusText}`);
    }
    
    return response.json();
  }

  async batchUpdate(updates: Array<{ id: string; updates: Partial<Tool> }>): Promise<Tool[]> {
    const response = await fetch(`${this.baseUrl}/batch/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to batch update: ${response.statusText}`);
    }
    
    return response.json();
  }
}