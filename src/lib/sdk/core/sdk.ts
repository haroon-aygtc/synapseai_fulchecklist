import { AgentService } from '../agents/agent-service';
import { ToolService } from '../services/tool-service';
import { WorkflowService } from '../services/workflow-service';
import { HybridOrchestrationService } from '../services/hybrid-orchestration-service';
import { ApixClient } from '../apix/client';

export interface SynapseSDKConfig {
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  userId?: string;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
  };
  realTimeEnabled?: boolean;
  debugMode?: boolean;
}

export interface EmbedWidgetConfig {
  containerId: string;
  agentId?: string;
  workflowId?: string;
  theme?: 'light' | 'dark' | 'auto';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  customStyles?: Record<string, string>;
  features?: {
    chat?: boolean;
    fileUpload?: boolean;
    voiceInput?: boolean;
    suggestions?: boolean;
    history?: boolean;
  };
  callbacks?: {
    onMessage?: (message: any) => void;
    onError?: (error: any) => void;
    onReady?: () => void;
    onClose?: () => void;
  };
}

export interface MultiFrameworkSupport {
  react: {
    components: Record<string, any>;
    hooks: Record<string, any>;
  };
  vue: {
    components: Record<string, any>;
    composables: Record<string, any>;
  };
  angular: {
    components: Record<string, any>;
    services: Record<string, any>;
  };
  vanilla: {
    widgets: Record<string, any>;
    utilities: Record<string, any>;
  };
}

export class SynapseSDK {
  private config: SynapseSDKConfig;
  private agentService: AgentService;
  private toolService: ToolService;
  private workflowService: WorkflowService;
  private hybridService: HybridOrchestrationService;
  private apixClient: ApixClient;
  private eventListeners: Map<string, Function[]> = new Map();
  private embeddedWidgets: Map<string, any> = new Map();

  constructor(config: SynapseSDKConfig = {}) {
    this.config = {
      baseUrl: 'https://api.synapseai.com',
      timeout: 30000,
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential'
      },
      realTimeEnabled: true,
      debugMode: false,
      ...config
    };

    this.initializeServices();
    this.setupGlobalErrorHandling();
    
    if (this.config.realTimeEnabled) {
      this.initializeRealTimeConnection();
    }
  }

  // Core Service Access
  get agents() {
    return this.agentService;
  }

  get tools() {
    return this.toolService;
  }

  get workflows() {
    return this.workflowService;
  }

  get hybrid() {
    return this.hybridService;
  }

  get realtime() {
    return this.apixClient;
  }

  // Embeddable Widget System
  async embedWidget(config: EmbedWidgetConfig): Promise<string> {
    const widgetId = this.generateId();
    
    try {
      const container = document.getElementById(config.containerId);
      if (!container) {
        throw new Error(`Container with ID '${config.containerId}' not found`);
      }

      const widget = await this.createWidget(widgetId, config);
      this.embeddedWidgets.set(widgetId, widget);

      // Inject widget into container
      container.appendChild(widget.element);

      // Initialize widget functionality
      await widget.initialize();

      if (config.callbacks?.onReady) {
        config.callbacks.onReady();
      }

      return widgetId;

    } catch (error) {
      if (config.callbacks?.onError) {
        config.callbacks.onError(error);
      }
      throw error;
    }
  }

  async removeWidget(widgetId: string): Promise<void> {
    const widget = this.embeddedWidgets.get(widgetId);
    if (widget) {
      await widget.destroy();
      this.embeddedWidgets.delete(widgetId);
    }
  }

  // Multi-Framework Component Generation
  generateComponents(framework: 'react' | 'vue' | 'angular' | 'vanilla'): MultiFrameworkSupport[keyof MultiFrameworkSupport] {
    switch (framework) {
      case 'react':
        return this.generateReactComponents();
      case 'vue':
        return this.generateVueComponents();
      case 'angular':
        return this.generateAngularComponents();
      case 'vanilla':
        return this.generateVanillaComponents();
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  // Theme and Language Support
  async setTheme(theme: 'light' | 'dark' | 'auto' | Record<string, string>): Promise<void> {
    if (typeof theme === 'string') {
      document.documentElement.setAttribute('data-synapse-theme', theme);
      
      if (theme === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const applyTheme = (e: MediaQueryListEvent | MediaQueryList) => {
          document.documentElement.setAttribute('data-synapse-theme', e.matches ? 'dark' : 'light');
        };
        
        applyTheme(mediaQuery);
        mediaQuery.addEventListener('change', applyTheme);
      }
    } else {
      // Custom theme object
      const styleSheet = document.createElement('style');
      styleSheet.textContent = this.generateThemeCSS(theme);
      document.head.appendChild(styleSheet);
    }

    // Update all embedded widgets
    for (const [widgetId, widget] of this.embeddedWidgets.entries()) {
      await widget.updateTheme(theme);
    }
  }

  async setLanguage(language: string): Promise<void> {
    try {
      const translations = await this.loadTranslations(language);
      this.applyTranslations(translations);
      
      // Update all embedded widgets
      for (const [widgetId, widget] of this.embeddedWidgets.entries()) {
        await widget.updateLanguage(language, translations);
      }
    } catch (error) {
      console.warn(`Failed to load language '${language}':`, error);
    }
  }

  // Real-time Synchronization
  async enableRealTimeSync(options?: {
    channels?: string[];
    autoReconnect?: boolean;
    heartbeatInterval?: number;
  }): Promise<void> {
    if (!this.config.realTimeEnabled) {
      this.config.realTimeEnabled = true;
      await this.initializeRealTimeConnection();
    }

    const channels = options?.channels || ['agents', 'workflows', 'tools', 'hybrid'];
    
    for (const channel of channels) {
      await this.apixClient.subscribe(`${channel}-events`, (event) => {
        this.handleRealTimeEvent(channel, event);
      });
    }
  }

  async disableRealTimeSync(): Promise<void> {
    if (this.apixClient) {
      await this.apixClient.disconnect();
    }
    this.config.realTimeEnabled = false;
  }

  // Event System
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback?: Function): void {
    if (!this.eventListeners.has(event)) return;
    
    if (callback) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for '${event}':`, error);
        }
      });
    }
  }

  // Advanced Features
  async createAgentChat(agentId: string, options?: {
    containerId?: string;
    theme?: string;
    features?: string[];
  }): Promise<any> {
    const chatWidget = new AgentChatWidget(agentId, {
      sdk: this,
      ...options
    });

    if (options?.containerId) {
      const container = document.getElementById(options.containerId);
      if (container) {
        container.appendChild(chatWidget.element);
      }
    }

    await chatWidget.initialize();
    return chatWidget;
  }

  async createWorkflowBuilder(options?: {
    containerId?: string;
    readonly?: boolean;
    templates?: any[];
  }): Promise<any> {
    const builderWidget = new WorkflowBuilderWidget({
      sdk: this,
      ...options
    });

    if (options?.containerId) {
      const container = document.getElementById(options.containerId);
      if (container) {
        container.appendChild(builderWidget.element);
      }
    }

    await builderWidget.initialize();
    return builderWidget;
  }

  async createFloatingAssistant(options?: {
    agentId?: string;
    position?: string;
    trigger?: 'click' | 'hover' | 'auto';
    delay?: number;
  }): Promise<any> {
    const assistant = new FloatingAssistantWidget({
      sdk: this,
      ...options
    });

    document.body.appendChild(assistant.element);
    await assistant.initialize();
    
    return assistant;
  }

  // Analytics and Monitoring
  async getUsageAnalytics(timeRange: string = '7d'): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/analytics/usage?timeRange=${timeRange}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get usage analytics: ${response.statusText}`);
    }

    return response.json();
  }

  async getPerformanceMetrics(): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/analytics/performance`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get performance metrics: ${response.statusText}`);
    }

    return response.json();
  }

  // Configuration Management
  async updateConfig(newConfig: Partial<SynapseSDKConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize services if necessary
    if (newConfig.baseUrl || newConfig.apiKey) {
      this.initializeServices();
    }

    if (newConfig.realTimeEnabled !== undefined) {
      if (newConfig.realTimeEnabled && !this.config.realTimeEnabled) {
        await this.initializeRealTimeConnection();
      } else if (!newConfig.realTimeEnabled && this.config.realTimeEnabled) {
        await this.disableRealTimeSync();
      }
    }
  }

  getConfig(): SynapseSDKConfig {
    return { ...this.config };
  }

  // Utility Methods
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    latency: number;
    timestamp: string;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        headers: this.getAuthHeaders(),
        timeout: 5000
      });

      const latency = Date.now() - startTime;
      const isHealthy = response.ok;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        services: {
          api: isHealthy,
          realtime: this.apixClient?.isConnected() || false,
          agents: true, // Would check actual service health
          tools: true,
          workflows: true,
          hybrid: true
        },
        latency,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        services: {
          api: false,
          realtime: false,
          agents: false,
          tools: false,
          workflows: false,
          hybrid: false
        },
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Private Methods
  private initializeServices(): void {
    this.agentService = new AgentService();
    this.toolService = new ToolService();
    this.workflowService = new WorkflowService();
    this.hybridService = new HybridOrchestrationService();
    this.apixClient = new ApixClient();
  }

  private async initializeRealTimeConnection(): Promise<void> {
    try {
      await this.apixClient.connect({
        url: this.config.baseUrl?.replace('http', 'ws') + '/ws',
        apiKey: this.config.apiKey,
        organizationId: this.config.organizationId
      });
    } catch (error) {
      console.error('Failed to initialize real-time connection:', error);
    }
  }

  private setupGlobalErrorHandling(): void {
    if (this.config.debugMode) {
      window.addEventListener('error', (event) => {
        if (event.error?.stack?.includes('synapse')) {
          console.error('SynapseSDK Error:', event.error);
          this.emit('error', event.error);
        }
      });

      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason?.stack?.includes('synapse')) {
          console.error('SynapseSDK Unhandled Rejection:', event.reason);
          this.emit('error', event.reason);
        }
      });
    }
  }

  private async createWidget(widgetId: string, config: EmbedWidgetConfig): Promise<any> {
    const widgetClass = this.getWidgetClass(config);
    return new widgetClass(widgetId, config, this);
  }

  private getWidgetClass(config: EmbedWidgetConfig): any {
    if (config.agentId) {
      return AgentChatWidget;
    } else if (config.workflowId) {
      return WorkflowExecutionWidget;
    } else {
      return GenericWidget;
    }
  }

  private generateReactComponents(): MultiFrameworkSupport['react'] {
    return {
      components: {
        AgentChat: this.createReactAgentChat(),
        WorkflowBuilder: this.createReactWorkflowBuilder(),
        FloatingAssistant: this.createReactFloatingAssistant(),
        ToolExecution: this.createReactToolExecution()
      },
      hooks: {
        useAgent: this.createUseAgentHook(),
        useWorkflow: this.createUseWorkflowHook(),
        useTool: this.createUseToolHook(),
        useRealTime: this.createUseRealTimeHook()
      }
    };
  }

  private generateVueComponents(): MultiFrameworkSupport['vue'] {
    return {
      components: {
        AgentChat: this.createVueAgentChat(),
        WorkflowBuilder: this.createVueWorkflowBuilder(),
        FloatingAssistant: this.createVueFloatingAssistant(),
        ToolExecution: this.createVueToolExecution()
      },
      composables: {
        useAgent: this.createVueUseAgent(),
        useWorkflow: this.createVueUseWorkflow(),
        useTool: this.createVueUseTool(),
        useRealTime: this.createVueUseRealTime()
      }
    };
  }

  private generateAngularComponents(): MultiFrameworkSupport['angular'] {
    return {
      components: {
        AgentChatComponent: this.createAngularAgentChat(),
        WorkflowBuilderComponent: this.createAngularWorkflowBuilder(),
        FloatingAssistantComponent: this.createAngularFloatingAssistant(),
        ToolExecutionComponent: this.createAngularToolExecution()
      },
      services: {
        AgentService: this.createAngularAgentService(),
        WorkflowService: this.createAngularWorkflowService(),
        ToolService: this.createAngularToolService(),
        RealTimeService: this.createAngularRealTimeService()
      }
    };
  }

  private generateVanillaComponents(): MultiFrameworkSupport['vanilla'] {
    return {
      widgets: {
        AgentChat: this.createVanillaAgentChat(),
        WorkflowBuilder: this.createVanillaWorkflowBuilder(),
        FloatingAssistant: this.createVanillaFloatingAssistant(),
        ToolExecution: this.createVanillaToolExecution()
      },
      utilities: {
        createAgent: this.createVanillaCreateAgent(),
        executeWorkflow: this.createVanillaExecuteWorkflow(),
        runTool: this.createVanillaRunTool(),
        connectRealTime: this.createVanillaConnectRealTime()
      }
    };
  }

  private handleRealTimeEvent(channel: string, event: any): void {
    this.emit(`${channel}:${event.type}`, event);
    this.emit('realtime:event', { channel, event });

    // Update embedded widgets
    for (const [widgetId, widget] of this.embeddedWidgets.entries()) {
      if (widget.handleRealTimeEvent) {
        widget.handleRealTimeEvent(channel, event);
      }
    }
  }

  private generateThemeCSS(theme: Record<string, string>): string {
    const cssRules = Object.entries(theme).map(([property, value]) => {
      const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `  --synapse-${cssProperty}: ${value};`;
    }).join('\n');

    return `:root {\n${cssRules}\n}`;
  }

  private async loadTranslations(language: string): Promise<Record<string, string>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/i18n/${language}.json`);
      if (!response.ok) {
        throw new Error(`Translation file not found for language: ${language}`);
      }
      return response.json();
    } catch (error) {
      console.warn(`Failed to load translations for ${language}:`, error);
      return {};
    }
  }

  private applyTranslations(translations: Record<string, string>): void {
    // Apply translations to existing elements
    document.querySelectorAll('[data-synapse-i18n]').forEach(element => {
      const key = element.getAttribute('data-synapse-i18n');
      if (key && translations[key]) {
        element.textContent = translations[key];
      }
    });
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.organizationId) {
      headers['X-Organization-ID'] = this.config.organizationId;
    }

    if (this.config.userId) {
      headers['X-User-ID'] = this.config.userId;
    }

    return headers;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Framework-specific component creators (simplified implementations)
  private createReactAgentChat(): any {
    return `
      import React, { useState, useEffect } from 'react';
      
      export const AgentChat = ({ agentId, theme, onMessage }) => {
        const [messages, setMessages] = useState([]);
        const [input, setInput] = useState('');
        
        // Implementation would go here
        return (
          <div className="synapse-agent-chat">
            {/* Chat UI */}
          </div>
        );
      };
    `;
  }

  private createUseAgentHook(): any {
    return `
      import { useState, useEffect } from 'react';
      
      export const useAgent = (agentId) => {
        const [agent, setAgent] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        
        // Implementation would go here
        return { agent, loading, error, sendMessage, createSession };
      };
    `;
  }

  // Additional framework implementations would follow similar patterns...
  private createVueAgentChat(): any { return {}; }
  private createVueUseAgent(): any { return {}; }
  private createAngularAgentChat(): any { return {}; }
  private createAngularAgentService(): any { return {}; }
  private createVanillaAgentChat(): any { return {}; }
  private createVanillaCreateAgent(): any { return {}; }

      // Production framework integrations
    this.frameworks = {
      react: new ReactFrameworkAdapter(this),
      vue: new VueFrameworkAdapter(this),
      angular: new AngularFrameworkAdapter(this),
      vanilla: new VanillaFrameworkAdapter(this)
    };
  private createReactWorkflowBuilder(): any { return {}; }
  private createReactFloatingAssistant(): any { return {}; }
  private createReactToolExecution(): any { return {}; }
  private createUseWorkflowHook(): any { return {}; }
  private createUseToolHook(): any { return {}; }
  private createUseRealTimeHook(): any { return {}; }
  private createVueWorkflowBuilder(): any { return {}; }
  private createVueFloatingAssistant(): any { return {}; }
  private createVueToolExecution(): any { return {}; }
  private createVueUseWorkflow(): any { return {}; }
  private createVueUseTool(): any { return {}; }
  private createVueUseRealTime(): any { return {}; }
  private createAngularWorkflowBuilder(): any { return {}; }
  private createAngularFloatingAssistant(): any { return {}; }
  private createAngularToolExecution(): any { return {}; }
  private createAngularWorkflowService(): any { return {}; }
  private createAngularToolService(): any { return {}; }
  private createAngularRealTimeService(): any { return {}; }
  private createVanillaWorkflowBuilder(): any { return {}; }
  private createVanillaFloatingAssistant(): any { return {}; }
  private createVanillaToolExecution(): any { return {}; }
  private createVanillaExecuteWorkflow(): any { return {}; }
  private createVanillaRunTool(): any { return {}; }
  private createVanillaConnectRealTime(): any { return {}; }
}

// Widget Base Classes
class BaseWidget {
  protected element: HTMLElement;
  protected config: any;
  protected sdk: SynapseSDK;

  constructor(id: string, config: any, sdk: SynapseSDK) {
    this.config = config;
    this.sdk = sdk;
    this.element = this.createElement(id);
  }

  protected createElement(id: string): HTMLElement {
    const element = document.createElement('div');
    element.id = id;
    element.className = 'synapse-widget';
    return element;
  }

  async initialize(): Promise<void> {
    // Override in subclasses
  }

  async destroy(): Promise<void> {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  async updateTheme(theme: any): Promise<void> {
    // Override in subclasses
  }

  async updateLanguage(language: string, translations: Record<string, string>): Promise<void> {
    // Override in subclasses
  }

  handleRealTimeEvent(channel: string, event: any): void {
    // Override in subclasses
  }
}

class AgentChatWidget extends BaseWidget {
  private agentId: string;
  private session: any;

  constructor(agentId: string, config: any) {
    super(config.id || 'agent-chat', config, config.sdk);
    this.agentId = agentId;
  }

  async initialize(): Promise<void> {
    this.element.innerHTML = `
      <div class="synapse-chat-container">
        <div class="synapse-chat-messages"></div>
        <div class="synapse-chat-input">
          <input type="text" placeholder="Type your message..." />
          <button>Send</button>
        </div>
      </div>
    `;

    // Initialize chat functionality
    this.session = await this.sdk.agents.createSession(this.agentId);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const input = this.element.querySelector('input') as HTMLInputElement;
    const button = this.element.querySelector('button') as HTMLButtonElement;

    button.addEventListener('click', () => this.sendMessage(input.value));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage(input.value);
    });
  }

  private async sendMessage(message: string): Promise<void> {
    if (!message.trim()) return;

    try {
      const response = await this.sdk.agents.sendMessage(this.session.sessionId, {
        message,
        role: 'user'
      });

      this.displayMessage('user', message);
      this.displayMessage('assistant', response.response);

      if (this.config.callbacks?.onMessage) {
        this.config.callbacks.onMessage({ message, response });
      }
    } catch (error) {
      if (this.config.callbacks?.onError) {
        this.config.callbacks.onError(error);
      }
    }
  }

  private displayMessage(role: string, content: string): void {
    const messagesContainer = this.element.querySelector('.synapse-chat-messages');
    if (messagesContainer) {
      const messageElement = document.createElement('div');
      messageElement.className = `synapse-message synapse-message-${role}`;
      messageElement.textContent = content;
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}

class WorkflowBuilderWidget extends BaseWidget {
  async initialize(): Promise<void> {
    this.element.innerHTML = `
      <div class="synapse-workflow-builder">
        <div class="synapse-workflow-canvas"></div>
        <div class="synapse-workflow-palette"></div>
      </div>
    `;
    // Initialize workflow builder functionality
  }
}

class WorkflowExecutionWidget extends BaseWidget {
  private workflowId: string;

  constructor(id: string, config: any, sdk: SynapseSDK) {
    super(id, config, sdk);
    this.workflowId = config.workflowId;
  }

  async initialize(): Promise<void> {
    this.element.innerHTML = `
      <div class="synapse-workflow-execution">
        <div class="synapse-workflow-status"></div>
        <div class="synapse-workflow-progress"></div>
      </div>
    `;
    // Initialize workflow execution monitoring
  }
}

class FloatingAssistantWidget extends BaseWidget {
  async initialize(): Promise<void> {
    this.element.className += ' synapse-floating-assistant';
    this.element.innerHTML = `
      <div class="synapse-assistant-trigger">
        <svg><!-- Assistant icon --></svg>
      </div>
      <div class="synapse-assistant-panel" style="display: none;">
        <div class="synapse-assistant-content"></div>
      </div>
    `;

    this.setupFloatingBehavior();
  }

  private setupFloatingBehavior(): void {
    const trigger = this.element.querySelector('.synapse-assistant-trigger');
    const panel = this.element.querySelector('.synapse-assistant-panel') as HTMLElement;

    trigger?.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }
}

class GenericWidget extends BaseWidget {
  async initialize(): Promise<void> {
    this.element.innerHTML = `
      <div class="synapse-generic-widget">
        <div class="synapse-widget-content">
          Generic SynapseAI Widget
        </div>
      </div>
    `;
  }
}

// Global SDK instance
let globalSDKInstance: SynapseSDK | null = null;

// Global initialization function
export function initializeSynapseSDK(config: SynapseSDKConfig): SynapseSDK {
  globalSDKInstance = new SynapseSDK(config);
  
  // Make SDK available globally
  (window as any).SynapseSDK = globalSDKInstance;
  
  return globalSDKInstance;
}

// Convenience function for embedding widgets
export function embedWidget(config: EmbedWidgetConfig): Promise<string> {
  if (!globalSDKInstance) {
    throw new Error('SynapseSDK not initialized. Call initializeSynapseSDK() first.');
  }
  return globalSDKInstance.embedWidget(config);
}

// Export everything
export {
  SynapseSDK,
  AgentChatWidget,
  WorkflowBuilderWidget,
  FloatingAssistantWidget,
  BaseWidget
};

export default SynapseSDK;