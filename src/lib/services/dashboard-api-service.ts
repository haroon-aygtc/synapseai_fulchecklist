import { toast } from '@/components/ui/use-toast';

export interface DashboardStats {
  agents: {
    total: number;
    active: number;
    inactive: number;
    totalConversations: number;
    avgSuccessRate: number;
  };
  workflows: {
    total: number;
    active: number;
    draft: number;
    totalExecutions: number;
    avgSuccessRate: number;
  };
  tools: {
    total: number;
    active: number;
    inactive: number;
    totalExecutions: number;
    avgSuccessRate: number;
  };
  knowledge: {
    totalDocuments: number;
    totalCollections: number;
    totalQueries: number;
    storageUsed: number; // in MB
  };
  usage: {
    totalApiCalls: number;
    totalTokensUsed: number;
    totalCost: number;
    monthlyApiCalls: number;
    monthlyTokensUsed: number;
    monthlyCost: number;
  };
  performance: {
    avgResponseTime: number;
    uptime: number;
    errorRate: number;
    successRate: number;
  };
}

export interface RecentActivity {
  id: string;
  type: 'agent_execution' | 'workflow_execution' | 'tool_execution' | 'user_action' | 'system_event';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'running' | 'pending';
  metadata: {
    resourceId?: string;
    resourceName?: string;
    userId?: string;
    userName?: string;
    duration?: number;
    cost?: number;
    [key: string]: any;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  services: {
    database: { status: 'up' | 'down'; responseTime: number };
    redis: { status: 'up' | 'down'; responseTime: number };
    vectorDb: { status: 'up' | 'down'; responseTime: number };
    apiGateway: { status: 'up' | 'down'; responseTime: number };
  };
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  alerts: {
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }[];
}

export interface UsageMetrics {
  period: 'today' | 'week' | 'month' | 'year';
  data: {
    date: string;
    apiCalls: number;
    tokensUsed: number;
    cost: number;
    executions: number;
    successRate: number;
  }[];
}

export interface TopResources {
  agents: {
    id: string;
    name: string;
    executions: number;
    successRate: number;
    cost: number;
  }[];
  workflows: {
    id: string;
    name: string;
    executions: number;
    successRate: number;
    cost: number;
  }[];
  tools: {
    id: string;
    name: string;
    executions: number;
    successRate: number;
    cost: number;
  }[];
}

class DashboardApiService {
  private baseUrl = '/api/dashboard';

  private getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    const organizationId = localStorage.getItem('currentOrganizationId');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Organization-Id': organizationId || ''
    };
  }

  async getStats(): Promise<DashboardStats> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      throw error;
    }
  }

  async getRecentActivity(limit: number = 20): Promise<{ activities: RecentActivity[]; total: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/activity?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recent activity: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        activities: data.activities || [],
        total: data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
      throw error;
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch system health: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      throw error;
    }
  }

  async getUsageMetrics(period: UsageMetrics['period'] = 'week'): Promise<UsageMetrics> {
    try {
      const response = await fetch(`${this.baseUrl}/usage?period=${period}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch usage metrics: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        period,
        data: data.metrics || []
      };
    } catch (error) {
      console.error('Failed to fetch usage metrics:', error);
      throw error;
    }
  }

  async getTopResources(): Promise<TopResources> {
    try {
      const response = await fetch(`${this.baseUrl}/top-resources`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch top resources: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch top resources:', error);
      throw error;
    }
  }

  async getOrganizationInsights(): Promise<{
    memberActivity: { userId: string; userName: string; actionsToday: number; lastActive: string }[];
    resourceGrowth: { date: string; agents: number; workflows: number; tools: number }[];
    costBreakdown: { category: string; amount: number; percentage: number }[];
    performanceTrends: { date: string; avgResponseTime: number; successRate: number; errorRate: number }[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/insights`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch organization insights: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch organization insights:', error);
      throw error;
    }
  }

  async exportData(type: 'stats' | 'activity' | 'usage', format: 'json' | 'csv' = 'json'): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/export/${type}?format=${format}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to export data: ${response.statusText}`);
      }

      const blob = await response.blob();
      toast({
        title: 'Export Complete',
        description: `${type} data has been exported successfully.`
      });

      return blob;
    } catch (error) {
      console.error('Failed to export data:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export data',
        variant: 'destructive'
      });
      throw error;
    }
  }

  async refreshCache(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/refresh-cache`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh cache: ${response.statusText}`);
      }

      toast({
        title: 'Cache Refreshed',
        description: 'Dashboard data has been refreshed successfully.'
      });
    } catch (error) {
      console.error('Failed to refresh cache:', error);
      toast({
        title: 'Refresh Failed',
        description: error instanceof Error ? error.message : 'Failed to refresh cache',
        variant: 'destructive'
      });
      throw error;
    }
  }

  // Real-time data subscription using WebSocket
  subscribeToRealTimeUpdates(onUpdate: (data: Partial<DashboardStats>) => void): () => void {
    // This would use the APIX client for real-time updates
    const eventSource = new EventSource(`${this.baseUrl}/stream`, {
      // Add auth headers for SSE
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
      } catch (error) {
        console.error('Failed to parse real-time update:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Real-time connection error:', error);
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }
}

export const dashboardApiService = new DashboardApiService();
export default dashboardApiService;