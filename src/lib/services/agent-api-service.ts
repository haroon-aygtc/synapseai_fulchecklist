import { toast } from '@/components/ui/use-toast';

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: 'standalone' | 'tool-driven' | 'hybrid' | 'multi-task' | 'multi-provider';
  status: 'active' | 'inactive' | 'draft' | 'error';
  model: string;
  provider: string;
  conversations: number;
  successRate: number;
  avgResponseTime: number;
  lastActive: string;
  createdAt: string;
  createdBy: string;
  tags: string[];
  capabilities: string[];
  cost: number;
  usage: {
    today: number;
    week: number;
    month: number;
  };
  organizationId: string;
  authorId: string;
  config?: Record<string, any>;
  systemPrompt?: string;
  tools?: string[];
  memory?: {
    type: 'conversation' | 'semantic' | 'episodic';
    maxTokens: number;
    retentionDays: number;
  };
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: Agent['type'];
  model: string;
  provider: string;
  tags: string[];
  popularity: number;
  rating: number;
  installs: number;
  template: {
    systemPrompt: string;
    config: Record<string, any>;
    tools: string[];
    memory: Agent['memory'];
  };
}

export interface CreateAgentRequest {
  name: string;
  description: string;
  type: Agent['type'];
  model: string;
  provider: string;
  systemPrompt?: string;
  tags?: string[];
  config?: Record<string, any>;
  tools?: string[];
  memory?: Agent['memory'];
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  status?: Agent['status'];
}

export interface GetAgentsQuery {
  organizationId: string;
  search?: string;
  type?: Agent['type'];
  status?: Agent['status'];
  provider?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  includeUsage?: boolean;
  includePerformance?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AgentExecutionRequest {
  input: string;
  context?: Record<string, any>;
  sessionId?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: string[];
}

export interface AgentExecution {
  id: string;
  agentId: string;
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  tokensUsed?: number;
  cost?: number;
  sessionId?: string;
  error?: string;
}

class AgentApiService {
  private baseUrl = '/api/agents';

  private getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    const organizationId = localStorage.getItem('currentOrganizationId');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Organization-Id': organizationId || ''
    };
  }

  async getAgents(query: GetAgentsQuery): Promise<{ agents: Agent[]; total: number }> {
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
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        agents: data.agents || [],
        total: data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      throw error;
    }
  }

  async getAgent(agentId: string): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/${agentId}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch agent:', error);
      throw error;
    }
  }

  async createAgent(agentData: CreateAgentRequest): Promise<Agent> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(agentData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create agent: ${response.statusText}`);
      }

      const agent = await response.json();
      toast({
        title: 'Agent Created',
        description: `${agent.name} has been created successfully.`
      });
      
      return agent;
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create agent',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async updateAgent(agentId: string, agentData: UpdateAgentRequest): Promise<Agent> {
    try {
      const response = await fetch(`${this.baseUrl}/${agentId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(agentData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update agent: ${response.statusText}`);
      }

      const agent = await response.json();
      toast({
        title: 'Agent Updated',
        description: `${agent.name} has been updated successfully.`
      });
      
      return agent;
    } catch (error) {
      console.error('Failed to update agent:', error);
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update agent',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${agentId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete agent: ${response.statusText}`);
      }

      toast({
        title: 'Agent Deleted',
        description: 'Agent has been deleted successfully.'
      });
    } catch (error) {
      console.error('Failed to delete agent:', error);
      toast({
        title: 'Deletion Failed',
        description: error instanceof Error ? error.message : 'Failed to delete agent',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async executeAgent(agentId: string, request: AgentExecutionRequest): Promise<AgentExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/${agentId}/execute`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to execute agent: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to execute agent:', error);
      throw error;
    }
  }

  async getAgentExecutions(agentId: string, limit: number = 50): Promise<{ executions: AgentExecution[]; total: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/${agentId}/executions?limit=${limit}`, {
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

  async getAgentPerformance(agentId: string): Promise<{
    usage: { today: number; week: number; month: number; total: number };
    performance: { successRate: number; errorRate: number; avgResponseTime: number };
    cost: { today: number; week: number; month: number; total: number };
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/${agentId}/performance`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch performance: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch performance:', error);
      throw error;
    }
  }

  async getTemplates(): Promise<{ templates: AgentTemplate[] }> {
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

  async createFromTemplate(templateId: string, customizations: Partial<CreateAgentRequest>): Promise<Agent> {
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

      const agent = await response.json();
      toast({
        title: 'Agent Created from Template',
        description: `${agent.name} has been created successfully.`
      });
      
      return agent;
    } catch (error) {
      console.error('Failed to create from template:', error);
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create agent from template',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async testAgent(agentId: string, testInput: string): Promise<AgentExecution> {
    try {
      const response = await fetch(`${this.baseUrl}/${agentId}/test`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ input: testInput })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to test agent: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to test agent:', error);
      throw error;
    }
  }
}

export const agentApiService = new AgentApiService();
export default agentApiService;