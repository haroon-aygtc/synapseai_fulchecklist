import { 
  Agent, 
  AgentConfiguration, 
  AgentSession, 
  AgentTask, 
  AgentType, 
  AgentStatus,
  TaskStatus,
  AgentTemplate,
  AgentPerformance,
  AgentAnalytics,
  AgentVersion,
  AgentDebugSession
} from './types';
import { agentMemoryManager } from './memory-manager';
import { apixClient } from '../apix/client';
import { Permission } from '../auth/types';

class AgentService {
  private static instance: AgentService;

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  // Agent CRUD Operations
  async createAgent(
    organizationId: string, 
    userId: string, 
    configuration: AgentConfiguration,
    permissions: Permission[]
  ): Promise<Agent> {
    // Validate permissions
    if (!permissions.includes(Permission.AGENT_CREATE)) {
      throw new Error('Insufficient permissions to create agent');
    }

    const agent: Agent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      createdBy: userId,
      configuration,
      version: '1.0.0',
      isActive: true,
      isPublic: false,
      tags: [],
      metadata: {},
      performance: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageResponseTime: 0,
        averageTokenUsage: 0,
        uptime: 100,
        errorRate: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store agent in database (simulated with Redis for now)
    await this.storeAgent(agent);

    // Emit agent creation event
    await apixClient.emit('agent-events', {
      type: 'AGENT_CREATED',
      agentId: agent.id,
      organizationId,
      userId,
      timestamp: new Date(),
      data: agent
    });

    return agent;
  }

  async getAgent(agentId: string, permissions: Permission[]): Promise<Agent | null> {
    if (!permissions.includes(Permission.AGENT_READ)) {
      throw new Error('Insufficient permissions to read agent');
    }

    return this.retrieveAgent(agentId);
  }

  async updateAgent(
    agentId: string, 
    updates: Partial<AgentConfiguration>,
    userId: string,
    permissions: Permission[]
  ): Promise<Agent | null> {
    if (!permissions.includes(Permission.AGENT_UPDATE)) {
      throw new Error('Insufficient permissions to update agent');
    }

    const agent = await this.retrieveAgent(agentId);
    if (!agent) return null;

    // Create new version
    const newVersion = await this.createAgentVersion(agent, updates, userId);

    // Update agent configuration
    agent.configuration = { ...agent.configuration, ...updates };
    agent.version = newVersion.version;
    agent.updatedAt = new Date();

    await this.storeAgent(agent);

    // Emit agent update event
    await apixClient.emit('agent-events', {
      type: 'AGENT_UPDATED',
      agentId: agent.id,
      organizationId: agent.organizationId,
      userId,
      timestamp: new Date(),
      data: { updates, newVersion: newVersion.version }
    });

    return agent;
  }

  async deleteAgent(agentId: string, userId: string, permissions: Permission[]): Promise<boolean> {
    if (!permissions.includes(Permission.AGENT_DELETE)) {
      throw new Error('Insufficient permissions to delete agent');
    }

    const agent = await this.retrieveAgent(agentId);
    if (!agent) return false;

    // Deactivate instead of hard delete for audit purposes
    agent.isActive = false;
    agent.updatedAt = new Date();
    await this.storeAgent(agent);

    // Clean up active sessions
    const sessions = await agentMemoryManager.getAgentSessions(agentId);
    for (const session of sessions) {
      if (session.status === AgentStatus.RUNNING) {
        await this.stopAgentSession(session.id, userId);
      }
    }

    // Emit agent deletion event
    await apixClient.emit('agent-events', {
      type: 'AGENT_DELETED',
      agentId: agent.id,
      organizationId: agent.organizationId,
      userId,
      timestamp: new Date(),
      data: { agentId }
    });

    return true;
  }

  // Agent Execution
  async startAgentSession(
    agentId: string, 
    userId: string, 
    context: Record<string, any> = {},
    permissions: Permission[]
  ): Promise<AgentSession> {
    if (!permissions.includes(Permission.AGENT_EXECUTE)) {
      throw new Error('Insufficient permissions to execute agent');
    }

    const agent = await this.retrieveAgent(agentId);
    if (!agent || !agent.isActive) {
      throw new Error('Agent not found or inactive');
    }

    const session: AgentSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      userId,
      organizationId: agent.organizationId,
      status: AgentStatus.RUNNING,
      context,
      memory: {
        shortTerm: {},
        longTerm: {},
        episodic: [],
        semantic: {},
        working: {},
        metadata: {
          totalSize: 0,
          lastPruned: new Date(),
          version: 1
        }
      },
      tasks: [],
      collaborators: [],
      startedAt: new Date(),
      lastActivityAt: new Date()
    };

    await agentMemoryManager.createAgentSession(session);

    // Emit session start event
    await apixClient.emit('agent-events', {
      type: 'SESSION_STARTED',
      agentId,
      sessionId: session.id,
      organizationId: agent.organizationId,
      userId,
      timestamp: new Date(),
      data: { context }
    });

    return session;
  }

  async stopAgentSession(sessionId: string, userId: string): Promise<void> {
    const session = await agentMemoryManager.getAgentSession(sessionId);
    if (!session) return;

    await agentMemoryManager.updateAgentSession(sessionId, {
      status: AgentStatus.IDLE,
      endedAt: new Date()
    });

    // Emit session stop event
    await apixClient.emit('agent-events', {
      type: 'SESSION_STOPPED',
      agentId: session.agentId,
      sessionId,
      organizationId: session.organizationId,
      userId,
      timestamp: new Date(),
      data: { sessionId }
    });
  }

  async executeTask(
    sessionId: string, 
    taskName: string, 
    input: Record<string, any>,
    userId: string
  ): Promise<AgentTask> {
    const session = await agentMemoryManager.getAgentSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      name: taskName,
      description: `Execute ${taskName}`,
      status: TaskStatus.PENDING,
      priority: 1,
      input,
      progress: 0,
      dependencies: [],
      createdAt: new Date()
    };

    await agentMemoryManager.createTask(task);

    // Start task execution
    this.processTask(task, session, userId);

    return task;
  }

  private async processTask(task: AgentTask, session: AgentSession, userId: string): Promise<void> {
    try {
      // Update task status to in progress
      await agentMemoryManager.updateTask(task.id, {
        status: TaskStatus.IN_PROGRESS,
        progress: 10
      });

      // Emit task start event
      await apixClient.emit('agent-events', {
        type: 'TASK_STARTED',
        agentId: session.agentId,
        sessionId: session.id,
        taskId: task.id,
        organizationId: session.organizationId,
        userId,
        timestamp: new Date(),
        data: { task }
      });

      // Simulate task processing (in real implementation, this would call the actual agent)
      const agent = await this.retrieveAgent(session.agentId);
      if (!agent) throw new Error('Agent not found');

      // Process based on agent type
      let result: any;
      switch (agent.configuration.type) {
        case AgentType.STANDALONE:
          result = await this.processStandaloneTask(task, session, agent);
          break;
        case AgentType.TOOL_DRIVEN:
          result = await this.processToolDrivenTask(task, session, agent);
          break;
        case AgentType.HYBRID:
          result = await this.processHybridTask(task, session, agent);
          break;
        case AgentType.MULTI_TASK:
          result = await this.processMultiTask(task, session, agent);
          break;
        case AgentType.MULTI_PROVIDER:
          result = await this.processMultiProviderTask(task, session, agent);
          break;
        default:
          throw new Error(`Unsupported agent type: ${agent.configuration.type}`);
      }

      // Update task with result
      await agentMemoryManager.updateTask(task.id, {
        status: TaskStatus.COMPLETED,
        progress: 100,
        output: result
      });

      // Update agent performance
      await this.updateAgentPerformance(session.agentId, true, Date.now() - task.createdAt.getTime());

      // Emit task completion event
      await apixClient.emit('agent-events', {
        type: 'TASK_COMPLETED',
        agentId: session.agentId,
        sessionId: session.id,
        taskId: task.id,
        organizationId: session.organizationId,
        userId,
        timestamp: new Date(),
        data: { result }
      });

    } catch (error) {
      // Update task with error
      await agentMemoryManager.updateTask(task.id, {
        status: TaskStatus.FAILED,
        error: (error as Error).message
      });

      // Update agent performance
      await this.updateAgentPerformance(session.agentId, false, 0);

      // Emit task failure event
      await apixClient.emit('agent-events', {
        type: 'TASK_FAILED',
        agentId: session.agentId,
        sessionId: session.id,
        taskId: task.id,
        organizationId: session.organizationId,
        userId,
        timestamp: new Date(),
        data: { error: (error as Error).message }
      });
    }
  }

  private async processStandaloneTask(task: AgentTask, session: AgentSession, agent: Agent): Promise<any> {
    // Simulate standalone agent processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { message: `Standalone agent processed: ${task.name}`, timestamp: new Date() };
  }

  private async processToolDrivenTask(task: AgentTask, session: AgentSession, agent: Agent): Promise<any> {
    // Simulate tool-driven agent processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { message: `Tool-driven agent processed: ${task.name}`, tools: agent.configuration.tools };
  }

  private async processHybridTask(task: AgentTask, session: AgentSession, agent: Agent): Promise<any> {
    // Simulate hybrid agent processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { message: `Hybrid agent processed: ${task.name}`, hybrid: true };
  }

  private async processMultiTask(task: AgentTask, session: AgentSession, agent: Agent): Promise<any> {
    // Simulate multi-task agent processing
    await new Promise(resolve => setTimeout(resolve, 1200));
    return { message: `Multi-task agent processed: ${task.name}`, subtasks: 3 };
  }

  private async processMultiProviderTask(task: AgentTask, session: AgentSession, agent: Agent): Promise<any> {
    // Simulate multi-provider agent processing
    await new Promise(resolve => setTimeout(resolve, 1800));
    return { message: `Multi-provider agent processed: ${task.name}`, provider: agent.configuration.provider };
  }

  // Agent Collaboration
  async createCollaborationRoom(
    name: string, 
    organizationId: string, 
    settings: any,
    userId: string
  ): Promise<string> {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const room = {
      id: roomId,
      name,
      organizationId,
      participants: [],
      settings: {
        maxParticipants: 10,
        allowGuestAgents: false,
        memorySharing: true,
        messageRetention: 7 * 24 * 60 * 60, // 7 days
        ...settings
      },
      createdAt: new Date(),
      lastActivityAt: new Date()
    };

    await agentMemoryManager.createRoom(room);

    // Emit room creation event
    await apixClient.emit('agent-events', {
      type: 'ROOM_CREATED',
      roomId,
      organizationId,
      userId,
      timestamp: new Date(),
      data: { room }
    });

    return roomId;
  }

  async joinCollaborationRoom(roomId: string, agentId: string, userId: string): Promise<boolean> {
    const success = await agentMemoryManager.joinRoom(roomId, agentId);
    
    if (success) {
      // Emit join event
      await apixClient.emit('agent-events', {
        type: 'AGENT_JOINED_ROOM',
        roomId,
        agentId,
        userId,
        timestamp: new Date(),
        data: { roomId, agentId }
      });
    }

    return success;
  }

  async sendCollaborationMessage(
    roomId: string, 
    fromAgentId: string, 
    toAgentId: string | undefined, 
    content: any,
    userId: string
  ): Promise<void> {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgentId,
      toAgentId,
      type: toAgentId ? 'request' as const : 'broadcast' as const,
      content,
      metadata: { userId },
      timestamp: new Date()
    };

    await agentMemoryManager.sendMessage(roomId, message);
  }

  // Agent Templates and Marketplace
  async getAgentTemplates(category?: string): Promise<AgentTemplate[]> {
    // In a real implementation, this would fetch from database
    const templates: AgentTemplate[] = [
      {
        id: 'template_customer_support',
        name: 'Customer Support Agent',
        description: 'AI agent specialized in customer support and FAQ handling',
        category: 'Customer Service',
        type: AgentType.TOOL_DRIVEN,
        configuration: {
          name: 'Customer Support Agent',
          description: 'Handles customer inquiries and support tickets',
          type: AgentType.TOOL_DRIVEN,
          model: 'gpt-4',
          provider: 'openai',
          temperature: 0.7,
          maxTokens: 2000,
          systemPrompt: 'You are a helpful customer support agent...',
          tools: ['knowledge_base', 'ticket_system'],
          skills: ['customer_service', 'problem_solving'],
          memorySettings: {
            enabled: true,
            maxSize: 10000,
            pruningStrategy: 'intelligent',
            persistentMemory: true
          },
          collaborationSettings: {
            allowAgentToAgent: true,
            maxCollaborators: 5,
            shareMemory: false
          },
          securitySettings: {
            allowedDomains: [],
            rateLimits: {
              requestsPerMinute: 60,
              requestsPerHour: 1000
            },
            dataRetention: 30
          }
        },
        skills: [],
        tags: ['customer-service', 'support', 'faq'],
        isPublic: true,
        downloads: 1250,
        rating: 4.8,
        createdBy: 'system',
        createdAt: new Date()
      }
      // More templates would be added here
    ];

    return category ? templates.filter(t => t.category === category) : templates;
  }

  // Agent Analytics
  async getAgentAnalytics(agentId: string, period: 'hour' | 'day' | 'week' | 'month'): Promise<AgentAnalytics[]> {
    // In a real implementation, this would aggregate data from the database
    const analytics: AgentAnalytics[] = [];
    
    // Generate sample analytics data
    const now = new Date();
    const periods = period === 'hour' ? 24 : period === 'day' ? 30 : period === 'week' ? 12 : 12;
    
    for (let i = 0; i < periods; i++) {
      analytics.push({
        agentId,
        period,
        metrics: {
          executions: Math.floor(Math.random() * 100),
          successRate: 0.85 + Math.random() * 0.15,
          averageResponseTime: 500 + Math.random() * 1000,
          tokenUsage: Math.floor(Math.random() * 10000),
          errorCount: Math.floor(Math.random() * 5),
          userSatisfaction: 4.0 + Math.random() * 1.0
        },
        timestamp: new Date(now.getTime() - i * (period === 'hour' ? 3600000 : period === 'day' ? 86400000 : period === 'week' ? 604800000 : 2592000000))
      });
    }

    return analytics.reverse();
  }

  // Agent Debugging
  async createDebugSession(
    agentId: string, 
    sessionId: string, 
    userId: string,
    mode: 'step' | 'breakpoint' | 'trace'
  ): Promise<AgentDebugSession> {
    const debugSession: AgentDebugSession = {
      id: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      sessionId,
      userId,
      mode,
      breakpoints: [],
      variables: {},
      callStack: [],
      isActive: true,
      createdAt: new Date()
    };

    // Store debug session (in real implementation, this would be in database)
    // For now, we'll emit an event
    await apixClient.emit('agent-events', {
      type: 'DEBUG_SESSION_CREATED',
      agentId,
      sessionId,
      debugSessionId: debugSession.id,
      organizationId: '', // Would be fetched from agent
      userId,
      timestamp: new Date(),
      data: { debugSession }
    });

    return debugSession;
  }

  // Private helper methods
  private async storeAgent(agent: Agent): Promise<void> {
    // In a real implementation, this would store in database
    // For now, we'll use Redis as a temporary store
    const key = `agent:${agent.id}`;
    await agentMemoryManager['redis'].set(key, JSON.stringify(agent), 'EX', 7 * 24 * 60 * 60);
  }

  private async retrieveAgent(agentId: string): Promise<Agent | null> {
    // In a real implementation, this would fetch from database
    const key = `agent:${agentId}`;
    const data = await agentMemoryManager['redis'].get(key);
    
    if (!data) return null;
    
    try {
      const agent = JSON.parse(data);
      agent.createdAt = new Date(agent.createdAt);
      agent.updatedAt = new Date(agent.updatedAt);
      return agent;
    } catch (error) {
      console.error('Error parsing agent data:', error);
      return null;
    }
  }

  private async createAgentVersion(
    agent: Agent, 
    updates: Partial<AgentConfiguration>, 
    userId: string
  ): Promise<AgentVersion> {
    const version: AgentVersion = {
      id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: agent.id,
      version: this.incrementVersion(agent.version),
      configuration: { ...agent.configuration, ...updates },
      changelog: 'Configuration updated',
      isActive: true,
      createdBy: userId,
      createdAt: new Date()
    };

    // Store version (in real implementation, this would be in database)
    const key = `agent_version:${version.id}`;
    await agentMemoryManager['redis'].set(key, JSON.stringify(version), 'EX', 30 * 24 * 60 * 60);

    return version;
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private async updateAgentPerformance(agentId: string, success: boolean, responseTime: number): Promise<void> {
    const agent = await this.retrieveAgent(agentId);
    if (!agent) return;

    agent.performance.totalExecutions++;
    if (success) {
      agent.performance.successfulExecutions++;
    } else {
      agent.performance.failedExecutions++;
    }

    // Update averages
    const total = agent.performance.totalExecutions;
    agent.performance.averageResponseTime = 
      ((agent.performance.averageResponseTime * (total - 1)) + responseTime) / total;
    
    agent.performance.errorRate = agent.performance.failedExecutions / total;
    agent.performance.lastExecutionAt = new Date();

    await this.storeAgent(agent);
  }
}

export const agentService = AgentService.getInstance();