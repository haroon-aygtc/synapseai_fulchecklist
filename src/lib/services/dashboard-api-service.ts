export interface DashboardStats {
  agents: {
    total: number;
    active: number;
    draft: number;
    totalSessions: number;
    avgResponseTime: number;
  };
  tools: {
    total: number;
    active: number;
    totalExecutions: number;
    successRate: number;
  };
  workflows: {
    total: number;
    active: number;
    running: number;
    totalExecutions: number;
    successRate: number;
  };
  costs: {
    thisMonth: number;
    lastMonth: number;
    trend: number;
    breakdown: Array<{
      provider: string;
      amount: number;
      percentage: number;
    }>;
  };
}

export interface RecentActivity {
  id: string;
  type: 'agent' | 'tool' | 'workflow';
  action: string;
  name: string;
  timestamp: Date;
  status: 'success' | 'error' | 'running';
}

export interface RecentActivityResponse {
  activities: RecentActivity[];
  total: number;
  hasMore: boolean;
}

class DashboardApiService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private subscribers = new Set<(updates: Partial<DashboardStats>) => void>();
  private wsConnection: WebSocket | null = null;

  constructor() {
    this.initializeRealTimeUpdates();
  }

  async getStats(): Promise<DashboardStats> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboard/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions');
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const stats = await response.json();
      
      // Validate response structure
      if (!this.validateStatsResponse(stats)) {
        throw new Error('Invalid response format from API');
      }

      return stats;
    } catch (error) {
      console.error('Dashboard stats API error:', error);
      throw error;
    }
  }

  async getRecentActivity(limit: number = 20): Promise<RecentActivityResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboard/activity?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const activity = await response.json();
      
      // Transform timestamps to Date objects
      activity.activities = activity.activities.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));

      return activity;
    } catch (error) {
      console.error('Recent activity API error:', error);
      throw error;
    }
  }

  async getUsageMetrics(timeRange: '24h' | '7d' | '30d' | '90d' = '7d'): Promise<{
    agentSessions: Array<{ date: string; count: number; avgDuration: number }>;
    toolExecutions: Array<{ date: string; count: number; successRate: number }>;
    workflowRuns: Array<{ date: string; count: number; successRate: number }>;
    costs: Array<{ date: string; amount: number; provider: string }>;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboard/usage?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Organization-ID': this.getOrganizationId()
        }
      });

      if (!response.ok) {
        throw new Error(`Usage metrics API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Usage metrics API error:', error);
      throw error;
    }
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    services: Array<{
      name: string;
      status: 'up' | 'down' | 'degraded';
      responseTime: number;
      lastCheck: Date;
    }>;
    uptime: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboard/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Health check API error: ${response.status} ${response.statusText}`);
      }

      const health = await response.json();
      
      // Transform timestamps
      health.services = health.services.map((service: any) => ({
        ...service,
        lastCheck: new Date(service.lastCheck)
      }));

      return health;
    } catch (error) {
      console.error('System health API error:', error);
      throw error;
    }
  }

  async refreshCache(): Promise<void> {
    this.cache.clear();
    
    try {
      await Promise.all([
        this.getStats(),
        this.getRecentActivity(20),
        this.getSystemHealth()
      ]);
    } catch (error) {
      console.error('Failed to refresh dashboard cache:', error);
      throw error;
    }
  }

  async exportData(type: 'stats' | 'activity' | 'usage', format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dashboard/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Organization-ID': this.getOrganizationId()
        },
        body: JSON.stringify({ type, format })
      });

      if (!response.ok) {
        throw new Error(`Export API error: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export data API error:', error);
      throw error;
    }
  }

  subscribeToRealTimeUpdates(callback: (updates: Partial<DashboardStats>) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private initializeRealTimeUpdates(): void {
    if (typeof window === 'undefined') return;

    const wsUrl = `${this.baseUrl.replace('http', 'ws')}/api/dashboard/ws`;
    
    try {
      this.wsConnection = new WebSocket(wsUrl);
      
      this.wsConnection.onopen = () => {
        console.log('Dashboard WebSocket connected');
        
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
          
          if (data.type === 'stats_update') {
            this.subscribers.forEach(callback => callback(data.payload));
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('Dashboard WebSocket disconnected');
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          this.initializeRealTimeUpdates();
        }, 5000);
      };

      this.wsConnection.onerror = (error) => {
        console.error('Dashboard WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
    }
  }

  private validateStatsResponse(stats: any): boolean {
    return (
      stats &&
      typeof stats.agents === 'object' &&
      typeof stats.tools === 'object' &&
      typeof stats.workflows === 'object' &&
      typeof stats.costs === 'object' &&
      typeof stats.agents.total === 'number' &&
      typeof stats.tools.total === 'number' &&
      typeof stats.workflows.total === 'number' &&
      Array.isArray(stats.costs.breakdown)
    );
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

  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.subscribers.clear();
    this.cache.clear();
  }
}

const dashboardApiService = new DashboardApiService();
export default dashboardApiService;