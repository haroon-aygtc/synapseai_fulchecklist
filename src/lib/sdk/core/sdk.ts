import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { SDKConfig, APIResponse, RealtimeEvent, Workflow, Agent, Tool, WorkflowExecution } from '../types';

export class SynapseSDK {
  private config: SDKConfig;
  private httpClient: AxiosInstance;
  private socketClient: Socket | null = null;
  private eventListeners: Map<string, Set<(event: RealtimeEvent) => void>> = new Map();

  constructor(config: SDKConfig) {
    this.config = {
      enableRealtime: true,
      enableAnalytics: true,
      theme: 'auto',
      language: 'en',
      ...config
    };

    this.httpClient = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Tenant-ID': this.config.tenantId,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.setupInterceptors();
    
    if (this.config.enableRealtime) {
      this.initializeRealtime();
    }
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        if (this.config.enableAnalytics) {
          config.headers['X-Request-ID'] = this.generateRequestId();
          config.headers['X-SDK-Version'] = '1.0.0';
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.emit('auth:error', { error: 'Unauthorized' });
        }
        return Promise.reject(error);
      }
    );
  }

  private initializeRealtime(): void {
    this.socketClient = io(this.config.apiUrl, {
      auth: {
        token: this.config.apiKey,
        tenantId: this.config.tenantId
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socketClient.on('connect', () => {
      this.emit('realtime:connected', {});
    });

    this.socketClient.on('disconnect', () => {
      this.emit('realtime:disconnected', {});
    });

    this.socketClient.on('event', (event: RealtimeEvent) => {
      this.handleRealtimeEvent(event);
    });
  }

  private handleRealtimeEvent(event: RealtimeEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }

    // Emit to global listeners
    const globalListeners = this.eventListeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(listener => listener(event));
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event Management
  public on(eventType: string, listener: (event: RealtimeEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  public off(eventType: string, listener: (event: RealtimeEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  public emit(eventType: string, data: any): void {
    if (this.socketClient) {
      this.socketClient.emit('event', {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'sdk',
          tenantId: this.config.tenantId
        }
      });
    }
  }

  // Workflow Management
  public async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'tenantId'>): Promise<APIResponse<Workflow>> {
    const response = await this.httpClient.post('/workflows', workflow);
    return response.data;
  }

  public async getWorkflow(id: string): Promise<APIResponse<Workflow>> {
    const response = await this.httpClient.get(`/workflows/${id}`);
    return response.data;
  }

  public async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<APIResponse<Workflow>> {
    const response = await this.httpClient.put(`/workflows/${id}`, updates);
    return response.data;
  }

  public async deleteWorkflow(id: string): Promise<APIResponse<void>> {
    const response = await this.httpClient.delete(`/workflows/${id}`);
    return response.data;
  }

  public async listWorkflows(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
  }): Promise<APIResponse<{ workflows: Workflow[]; total: number }>> {
    const response = await this.httpClient.get('/workflows', { params });
    return response.data;
  }

  public async executeWorkflow(id: string, input: Record<string, any>): Promise<APIResponse<WorkflowExecution>> {
    const response = await this.httpClient.post(`/workflows/${id}/execute`, { input });
    return response.data;
  }

  public async getWorkflowExecution(executionId: string): Promise<APIResponse<WorkflowExecution>> {
    const response = await this.httpClient.get(`/executions/${executionId}`);
    return response.data;
  }

  public async cancelWorkflowExecution(executionId: string): Promise<APIResponse<void>> {
    const response = await this.httpClient.post(`/executions/${executionId}/cancel`);
    return response.data;
  }

  // Agent Management
  public async createAgent(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'tenantId'>): Promise<APIResponse<Agent>> {
    const response = await this.httpClient.post('/agents', agent);
    return response.data;
  }

  public async getAgent(id: string): Promise<APIResponse<Agent>> {
    const response = await this.httpClient.get(`/agents/${id}`);
    return response.data;
  }

  public async updateAgent(id: string, updates: Partial<Agent>): Promise<APIResponse<Agent>> {
    const response = await this.httpClient.put(`/agents/${id}`, updates);
    return response.data;
  }

  public async deleteAgent(id: string): Promise<APIResponse<void>> {
    const response = await this.httpClient.delete(`/agents/${id}`);
    return response.data;
  }

  public async listAgents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
  }): Promise<APIResponse<{ agents: Agent[]; total: number }>> {
    const response = await this.httpClient.get('/agents', { params });
    return response.data;
  }

  // Tool Management
  public async createTool(tool: Omit<Tool, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'tenantId'>): Promise<APIResponse<Tool>> {
    const response = await this.httpClient.post('/tools', tool);
    return response.data;
  }

  public async getTool(id: string): Promise<APIResponse<Tool>> {
    const response = await this.httpClient.get(`/tools/${id}`);
    return response.data;
  }

  public async updateTool(id: string, updates: Partial<Tool>): Promise<APIResponse<Tool>> {
    const response = await this.httpClient.put(`/tools/${id}`, updates);
    return response.data;
  }

  public async deleteTool(id: string): Promise<APIResponse<void>> {
    const response = await this.httpClient.delete(`/tools/${id}`);
    return response.data;
  }

  public async listTools(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
  }): Promise<APIResponse<{ tools: Tool[]; total: number }>> {
    const response = await this.httpClient.get('/tools', { params });
    return response.data;
  }

  // Schema Generation
  public async generateFormSchema(type: 'workflow' | 'agent' | 'tool', config: Record<string, any>): Promise<APIResponse<any>> {
    const response = await this.httpClient.post('/schemas/generate', { type, config });
    return response.data;
  }

  // Analytics
  public async getAnalytics(params: {
    type: 'workflow' | 'agent' | 'tool' | 'execution';
    timeRange: string;
    filters?: Record<string, any>;
  }): Promise<APIResponse<any>> {
    const response = await this.httpClient.get('/analytics', { params });
    return response.data;
  }

  // Utility Methods
  public getConfig(): SDKConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<SDKConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update HTTP client headers
    this.httpClient.defaults.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    this.httpClient.defaults.headers['X-Tenant-ID'] = this.config.tenantId;
  }

  public disconnect(): void {
    if (this.socketClient) {
      this.socketClient.disconnect();
      this.socketClient = null;
    }
    this.eventListeners.clear();
  }

  public isConnected(): boolean {
    return this.socketClient?.connected || false;
  }
}