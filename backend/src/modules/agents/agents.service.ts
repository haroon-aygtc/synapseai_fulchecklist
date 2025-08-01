import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { ProvidersService } from '../providers/providers.service';
import { Agent, AgentType, AgentSession, SessionStatus } from '@prisma/client';
import { z } from 'zod';

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.nativeEnum(AgentType).default(AgentType.STANDALONE),
  systemPrompt: z.string().optional(),
  model: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(2048),
  tools: z.array(z.string()).default([]),
  skills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any()).default({}),
    code: z.string().optional()
  })).default([]),
  config: z.object({
    memoryType: z.enum(['CONVERSATION', 'SEMANTIC', 'EPISODIC']).default('CONVERSATION'),
    memorySize: z.number().positive().default(10),
    contextWindow: z.number().positive().default(4000),
    responseFormat: z.enum(['TEXT', 'JSON', 'STRUCTURED']).default('TEXT'),
    enableFunctionCalling: z.boolean().default(false),
    enableMemoryPersistence: z.boolean().default(true),
    enableLearning: z.boolean().default(false),
    collaborationMode: z.enum(['NONE', 'SEQUENTIAL', 'PARALLEL', 'HIERARCHICAL']).default('NONE'),
    maxCollaborators: z.number().positive().default(5),
    trustLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM')
  }).default({}),
  metadata: z.record(z.any()).default({})
});

const UpdateAgentSchema = CreateAgentSchema.partial();

const CreateSessionSchema = z.object({
  context: z.record(z.any()).default({}),
  initialMessage: z.string().optional(),
  metadata: z.record(z.any()).default({})
});

const SendMessageSchema = z.object({
  message: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  metadata: z.record(z.any()).default({})
});

interface AgentMemory {
  conversationHistory: Array<{
    role: string;
    content: string;
    timestamp: Date;
    metadata?: any;
  }>;
  semanticMemory: Array<{
    concept: string;
    description: string;
    relevance: number;
    lastAccessed: Date;
  }>;
  episodicMemory: Array<{
    event: string;
    context: any;
    timestamp: Date;
    importance: number;
  }>;
  workingMemory: any;
}

interface AgentCollaborationContext {
  sessionId: string;
  collaborators: string[];
  sharedContext: any;
  communicationLog: Array<{
    from: string;
    to: string;
    message: string;
    timestamp: Date;
  }>;
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private activeSessions = new Map<string, AgentSession>();
  private agentMemories = new Map<string, AgentMemory>();
  private collaborationContexts = new Map<string, AgentCollaborationContext>();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService,
    private providers: ProvidersService
  ) {
    this.initializeMemoryManager();
  }

  async createAgent(
    userId: string,
    organizationId: string,
    data: z.infer<typeof CreateAgentSchema>
  ): Promise<Agent> {
    const validatedData = CreateAgentSchema.parse(data);

    // Validate tools exist
    if (validatedData.tools.length > 0) {
      const tools = await this.prisma.tool.findMany({
        where: {
          id: { in: validatedData.tools },
          organizationId
        }
      });

      if (tools.length !== validatedData.tools.length) {
        throw new BadRequestException('One or more tools not found');
      }
    }

    const agent = await this.prisma.agent.create({
      data: {
        ...validatedData,
        userId,
        organizationId,
        skills: validatedData.skills,
        config: validatedData.config,
        metadata: {
          ...validatedData.metadata,
          createdBy: userId,
          totalSessions: 0,
          totalMessages: 0,
          avgResponseTime: 0,
          successRate: 100,
          lastUsed: null,
          skillsCount: validatedData.skills.length,
          toolsCount: validatedData.tools.length
        }
      }
    });

    // Initialize agent memory
    this.initializeAgentMemory(agent.id);

    await this.apix.publishEvent('agent-events', {
      type: 'AGENT_CREATED',
      agentId: agent.id,
      organizationId,
      data: agent
    });

    return agent;
  }

  async getAgents(
    organizationId: string,
    filters?: {
      type?: AgentType;
      isActive?: boolean;
      search?: string;
      tags?: string[];
    }
  ): Promise<Agent[]> {
    const where: any = { organizationId, isActive: true };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return this.prisma.agent.findMany({
      where,
      include: {
        sessions: {
          take: 5,
          orderBy: { startedAt: 'desc' },
          where: { status: { not: SessionStatus.INACTIVE } }
        },
        _count: {
          select: { sessions: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getAgent(id: string, organizationId: string): Promise<Agent> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, organizationId },
      include: {
        sessions: {
          take: 10,
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent;
  }

  async updateAgent(
    id: string,
    organizationId: string,
    data: z.infer<typeof UpdateAgentSchema>
  ): Promise<Agent> {
    const validatedData = UpdateAgentSchema.parse(data);

    const existingAgent = await this.prisma.agent.findFirst({
      where: { id, organizationId }
    });

    if (!existingAgent) {
      throw new NotFoundException('Agent not found');
    }

    // Validate tools if provided
    if (validatedData.tools && validatedData.tools.length > 0) {
      const tools = await this.prisma.tool.findMany({
        where: {
          id: { in: validatedData.tools },
          organizationId
        }
      });

      if (tools.length !== validatedData.tools.length) {
        throw new BadRequestException('One or more tools not found');
      }
    }

    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...validatedData,
        version: { increment: 1 },
        updatedAt: new Date(),
        metadata: {
          ...existingAgent.metadata,
          lastModifiedBy: organizationId,
          skillsCount: validatedData.skills?.length || existingAgent.metadata?.skillsCount,
          toolsCount: validatedData.tools?.length || existingAgent.metadata?.toolsCount
        }
      }
    });

    // Update agent memory configuration if needed
    if (validatedData.config) {
      await this.updateAgentMemoryConfig(id, validatedData.config);
    }

    await this.apix.publishEvent('agent-events', {
      type: 'AGENT_UPDATED',
      agentId: agent.id,
      organizationId,
      data: agent
    });

    return agent;
  }

  async deleteAgent(id: string, organizationId: string): Promise<void> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, organizationId }
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // End all active sessions
    await this.prisma.agentSession.updateMany({
      where: { agentId: id, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.INACTIVE, endedAt: new Date() }
    });

    // Clean up memory
    this.agentMemories.delete(id);
    await this.redis.del(`agent_memory:${id}`);

    await this.prisma.agent.delete({
      where: { id }
    });

    await this.apix.publishEvent('agent-events', {
      type: 'AGENT_DELETED',
      agentId: id,
      organizationId
    });
  }

  async cloneAgent(
    id: string,
    organizationId: string,
    userId: string,
    options?: { name?: string; description?: string }
  ): Promise<Agent> {
    const originalAgent = await this.getAgent(id, organizationId);

    const clonedData = {
      name: options?.name || `${originalAgent.name} (Copy)`,
      description: options?.description || originalAgent.description,
      type: originalAgent.type,
      systemPrompt: originalAgent.systemPrompt,
      model: originalAgent.model,
      temperature: originalAgent.temperature,
      maxTokens: originalAgent.maxTokens,
      tools: originalAgent.tools,
      skills: originalAgent.skills,
      config: originalAgent.config,
      metadata: {}
    };

    return this.createAgent(userId, organizationId, clonedData);
  }

  async createSession(
    agentId: string,
    organizationId: string,
    userId: string,
    data: z.infer<typeof CreateSessionSchema> = {}
  ): Promise<AgentSession> {
    const validatedData = CreateSessionSchema.parse(data);

    const agent = await this.getAgent(agentId, organizationId);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = await this.prisma.agentSession.create({
      data: {
        sessionId,
        agentId,
        userId,
        status: SessionStatus.ACTIVE,
        context: validatedData.context,
        memory: {},
        messages: validatedData.initialMessage ? [{
          role: 'user',
          content: validatedData.initialMessage,
          timestamp: new Date().toISOString()
        }] : [],
        metadata: {
          ...validatedData.metadata,
          agentType: agent.type,
          agentName: agent.name,
          startedBy: userId
        }
      }
    });

    // Initialize session memory
    await this.initializeSessionMemory(session.sessionId, agent);

    // Store in active sessions
    this.activeSessions.set(session.sessionId, session);

    // Process initial message if provided
    if (validatedData.initialMessage) {
      await this.processMessage(session, {
        message: validatedData.initialMessage,
        role: 'user',
        metadata: {}
      });
    }

    await this.apix.publishEvent('agent-events', {
      type: 'SESSION_CREATED',
      agentId,
      sessionId: session.sessionId,
      organizationId,
      data: session
    });

    return session;
  }

  async sendMessage(
    sessionId: string,
    organizationId: string,
    data: z.infer<typeof SendMessageSchema>
  ): Promise<{ response: string; metadata: any }> {
    const validatedData = SendMessageSchema.parse(data);

    const session = await this.prisma.agentSession.findFirst({
      where: { sessionId, status: SessionStatus.ACTIVE },
      include: { agent: true }
    });

    if (!session) {
      throw new NotFoundException('Active session not found');
    }

    if (session.agent.organizationId !== organizationId) {
      throw new NotFoundException('Session not found');
    }

    return this.processMessage(session, validatedData);
  }

  private async processMessage(
    session: AgentSession & { agent?: Agent },
    messageData: z.infer<typeof SendMessageSchema>
  ): Promise<{ response: string; metadata: any }> {
    const startTime = Date.now();

    try {
      // Get agent if not included
      const agent = session.agent || await this.prisma.agent.findUnique({
        where: { id: session.agentId }
      });

      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      // Update session with new message
      const messages = [...(session.messages as any[]), {
        role: messageData.role,
        content: messageData.message,
        timestamp: new Date().toISOString(),
        metadata: messageData.metadata
      }];

      // Get agent memory
      const memory = await this.getAgentMemory(agent.id, session.sessionId);

      // Prepare context for agent
      const context = await this.prepareAgentContext(agent, session, memory, messageData.message);

      // Execute agent based on type
      let response: any;
      switch (agent.type) {
        case AgentType.STANDALONE:
          response = await this.executeStandaloneAgent(agent, context);
          break;
        case AgentType.TOOL_DRIVEN:
          response = await this.executeToolDrivenAgent(agent, context);
          break;
        case AgentType.HYBRID:
          response = await this.executeHybridAgent(agent, context);
          break;
        case AgentType.MULTI_TASK:
          response = await this.executeMultiTaskAgent(agent, context);
          break;
        case AgentType.MULTI_PROVIDER:
          response = await this.executeMultiProviderAgent(agent, context);
          break;
        default:
          response = await this.executeStandaloneAgent(agent, context);
      }

      // Update memory
      await this.updateAgentMemory(agent.id, session.sessionId, {
        userMessage: messageData.message,
        agentResponse: response.content,
        context: context,
        metadata: response.metadata
      });

      // Add response to messages
      messages.push({
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        metadata: response.metadata
      });

      // Update session
      const duration = Date.now() - startTime;
      await this.prisma.agentSession.update({
        where: { id: session.id },
        data: {
          messages,
          lastActivityAt: new Date(),
          metadata: {
            ...session.metadata,
            totalMessages: messages.length,
            avgResponseTime: ((session.metadata as any)?.avgResponseTime || 0 + duration) / 2
          }
        }
      });

      // Update agent statistics
      await this.updateAgentStats(agent.id, duration, true);

      // Publish events
      await this.apix.publishEvent('agent-events', {
        type: 'MESSAGE_PROCESSED',
        agentId: agent.id,
        sessionId: session.sessionId,
        organizationId: agent.organizationId,
        data: {
          message: messageData.message,
          response: response.content,
          duration,
          metadata: response.metadata
        }
      });

      return {
        response: response.content,
        metadata: {
          ...response.metadata,
          duration,
          tokensUsed: response.usage?.total_tokens,
          model: response.model,
          provider: response.provider
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update agent statistics for failure
      await this.updateAgentStats(session.agentId, duration, false);

      await this.apix.publishEvent('agent-events', {
        type: 'MESSAGE_FAILED',
        agentId: session.agentId,
        sessionId: session.sessionId,
        organizationId: session.agent?.organizationId,
        data: {
          message: messageData.message,
          error: error.message,
          duration
        }
      });

      throw error;
    }
  }

  private async executeStandaloneAgent(agent: Agent, context: any): Promise<any> {
    const messages = [
      { role: 'system', content: agent.systemPrompt || 'You are a helpful AI assistant.' },
      ...context.conversationHistory.slice(-10), // Last 10 messages
      { role: 'user', content: context.currentMessage }
    ];

    return this.providers.executeWithSmartRouting(
      agent.organizationId,
      {
        messages,
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens
      }
    );
  }

  private async executeToolDrivenAgent(agent: Agent, context: any): Promise<any> {
    // Get available tools
    const tools = await this.getAgentTools(agent.tools);

    const messages = [
      { 
        role: 'system', 
        content: `${agent.systemPrompt || 'You are a helpful AI assistant.'}\n\nYou have access to the following tools: ${tools.map(t => t.function.name).join(', ')}. Use them when appropriate to help the user.`
      },
      ...context.conversationHistory.slice(-10),
      { role: 'user', content: context.currentMessage }
    ];

    const response = await this.providers.executeWithSmartRouting(
      agent.organizationId,
      {
        messages,
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        tools
      }
    );

    // Process tool calls if any
    if (response.tool_calls) {
      const toolResults = await this.executeToolCalls(response.tool_calls, agent.organizationId);
      
      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls });
      messages.push(...toolResults.map(result => ({
        role: 'tool',
        content: JSON.stringify(result.output),
        tool_call_id: result.tool_call_id
      })));

      return this.providers.executeWithSmartRouting(
        agent.organizationId,
        {
          messages,
          model: agent.model,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens
        }
      );
    }

    return response;
  }

  private async executeHybridAgent(agent: Agent, context: any): Promise<any> {
    const config = agent.config as any;
    
    // Execute both conversational and tool-driven logic
    const conversationalResponse = await this.executeStandaloneAgent(agent, context);
    
    // Determine if tools should be used based on the response
    const shouldUseTool = this.shouldUseTool(conversationalResponse.content, context);
    
    if (shouldUseTool && agent.tools.length > 0) {
      const toolResponse = await this.executeToolDrivenAgent(agent, context);
      
      // Combine responses based on configuration
      return this.combineHybridResponses(conversationalResponse, toolResponse, config);
    }

    return conversationalResponse;
  }

  private async executeMultiTaskAgent(agent: Agent, context: any): Promise<any> {
    const config = agent.config as any;
    
    // Break down the task into subtasks
    const subtasks = await this.decomposeTask(context.currentMessage, agent);
    
    const results = [];
    for (const subtask of subtasks) {
      const subtaskContext = { ...context, currentMessage: subtask };
      const result = await this.executeStandaloneAgent(agent, subtaskContext);
      results.push(result);
    }

    // Combine results
    return this.combineMultiTaskResults(results, config);
  }

  private async executeMultiProviderAgent(agent: Agent, context: any): Promise<any> {
    const config = agent.config as any;
    const providers = config.providers || ['openai', 'anthropic'];
    
    // Execute with multiple providers in parallel
    const promises = providers.map(async (provider: string) => {
      try {
        return await this.providers.executeWithSmartRouting(
          agent.organizationId,
          {
            messages: [
              { role: 'system', content: agent.systemPrompt || 'You are a helpful AI assistant.' },
              ...context.conversationHistory.slice(-5),
              { role: 'user', content: context.currentMessage }
            ],
            model: agent.model,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens
          },
          { preferredProvider: provider }
        );
      } catch (error) {
        return { error: error.message, provider };
      }
    });

    const results = await Promise.all(promises);
    
    // Select best response based on configuration
    return this.selectBestMultiProviderResponse(results, config);
  }

  // Agent collaboration methods
  async initiateCollaboration(
    initiatorAgentId: string,
    collaboratorAgentIds: string[],
    organizationId: string,
    context: any
  ): Promise<string> {
    const collaborationId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const collaborationContext: AgentCollaborationContext = {
      sessionId: collaborationId,
      collaborators: [initiatorAgentId, ...collaboratorAgentIds],
      sharedContext: context,
      communicationLog: []
    };

    this.collaborationContexts.set(collaborationId, collaborationContext);

    // Notify all agents about the collaboration
    for (const agentId of collaborationContext.collaborators) {
      await this.apix.publishEvent('agent-events', {
        type: 'COLLABORATION_INITIATED',
        agentId,
        organizationId,
        data: {
          collaborationId,
          collaborators: collaborationContext.collaborators,
          context
        }
      });
    }

    return collaborationId;
  }

  async sendCollaborationMessage(
    collaborationId: string,
    fromAgentId: string,
    toAgentId: string,
    message: string,
    organizationId: string
  ): Promise<void> {
    const collaboration = this.collaborationContexts.get(collaborationId);
    if (!collaboration) {
      throw new NotFoundException('Collaboration not found');
    }

    if (!collaboration.collaborators.includes(fromAgentId) || 
        !collaboration.collaborators.includes(toAgentId)) {
      throw new BadRequestException('Agent not part of collaboration');
    }

    collaboration.communicationLog.push({
      from: fromAgentId,
      to: toAgentId,
      message,
      timestamp: new Date()
    });

    await this.apix.publishEvent('agent-events', {
      type: 'COLLABORATION_MESSAGE',
      agentId: toAgentId,
      organizationId,
      data: {
        collaborationId,
        fromAgentId,
        message,
        sharedContext: collaboration.sharedContext
      }
    });
  }

  // Memory management methods
  private initializeMemoryManager(): void {
    // Set up memory pruning interval
    setInterval(() => {
      this.pruneMemories();
    }, 60000); // Every minute
  }

  private initializeAgentMemory(agentId: string): void {
    const memory: AgentMemory = {
      conversationHistory: [],
      semanticMemory: [],
      episodicMemory: [],
      workingMemory: {}
    };

    this.agentMemories.set(agentId, memory);
  }

  private async initializeSessionMemory(sessionId: string, agent: Agent): Promise<void> {
    const config = agent.config as any;
    
    // Load persistent memory if enabled
    if (config.enableMemoryPersistence) {
      const persistedMemory = await this.redis.get(`agent_memory:${agent.id}`);
      if (persistedMemory) {
        const memory = JSON.parse(persistedMemory);
        this.agentMemories.set(`${agent.id}:${sessionId}`, memory);
      }
    }
  }

  private async getAgentMemory(agentId: string, sessionId: string): Promise<AgentMemory> {
    const memoryKey = `${agentId}:${sessionId}`;
    let memory = this.agentMemories.get(memoryKey);
    
    if (!memory) {
      memory = this.agentMemories.get(agentId) || {
        conversationHistory: [],
        semanticMemory: [],
        episodicMemory: [],
        workingMemory: {}
      };
      this.agentMemories.set(memoryKey, memory);
    }

    return memory;
  }

  private async updateAgentMemory(
    agentId: string,
    sessionId: string,
    interaction: {
      userMessage: string;
      agentResponse: string;
      context: any;
      metadata: any;
    }
  ): Promise<void> {
    const memoryKey = `${agentId}:${sessionId}`;
    const memory = await this.getAgentMemory(agentId, sessionId);

    // Update conversation history
    memory.conversationHistory.push(
      {
        role: 'user',
        content: interaction.userMessage,
        timestamp: new Date(),
        metadata: interaction.metadata
      },
      {
        role: 'assistant',
        content: interaction.agentResponse,
        timestamp: new Date(),
        metadata: interaction.metadata
      }
    );

    // Limit conversation history size
    if (memory.conversationHistory.length > 50) {
      memory.conversationHistory = memory.conversationHistory.slice(-50);
    }

    // Extract and update semantic memory
    await this.updateSemanticMemory(memory, interaction);

    // Update episodic memory
    memory.episodicMemory.push({
      event: `User asked: ${interaction.userMessage.substring(0, 100)}...`,
      context: interaction.context,
      timestamp: new Date(),
      importance: this.calculateImportance(interaction)
    });

    // Limit episodic memory size
    if (memory.episodicMemory.length > 100) {
      memory.episodicMemory = memory.episodicMemory
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 100);
    }

    this.agentMemories.set(memoryKey, memory);

    // Persist memory if enabled
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (agent && (agent.config as any)?.enableMemoryPersistence) {
      await this.redis.set(
        `agent_memory:${agentId}`,
        JSON.stringify(memory),
        'EX',
        86400 * 7 // 7 days
      );
    }
  }

  private async updateSemanticMemory(memory: AgentMemory, interaction: any): Promise<void> {
    // Extract concepts from the interaction (simplified)
    const concepts = this.extractConcepts(interaction.userMessage + ' ' + interaction.agentResponse);
    
    for (const concept of concepts) {
      const existing = memory.semanticMemory.find(m => m.concept === concept);
      if (existing) {
        existing.relevance += 0.1;
        existing.lastAccessed = new Date();
      } else {
        memory.semanticMemory.push({
          concept,
          description: `Concept extracted from conversation`,
          relevance: 1.0,
          lastAccessed: new Date()
        });
      }
    }

    // Limit semantic memory size and decay relevance
    memory.semanticMemory = memory.semanticMemory
      .map(m => ({ ...m, relevance: m.relevance * 0.99 })) // Decay
      .filter(m => m.relevance > 0.1) // Remove low relevance
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 200); // Keep top 200
  }

  private async updateAgentMemoryConfig(agentId: string, config: any): Promise<void> {
    // Update memory configuration for all sessions of this agent
    const memoryKeys = Array.from(this.agentMemories.keys()).filter(key => key.startsWith(agentId));
    
    for (const key of memoryKeys) {
      const memory = this.agentMemories.get(key);
      if (memory) {
        // Apply new memory limits
        if (config.memorySize) {
          memory.conversationHistory = memory.conversationHistory.slice(-config.memorySize);
        }
        
        this.agentMemories.set(key, memory);
      }
    }
  }

  private pruneMemories(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, memory] of this.agentMemories.entries()) {
      // Remove old conversation history
      memory.conversationHistory = memory.conversationHistory.filter(
        msg => now - msg.timestamp.getTime() < maxAge
      );

      // Decay semantic memory relevance
      memory.semanticMemory = memory.semanticMemory
        .map(m => ({ ...m, relevance: m.relevance * 0.95 }))
        .filter(m => m.relevance > 0.05);

      // Remove old episodic memories
      memory.episodicMemory = memory.episodicMemory.filter(
        event => now - event.timestamp.getTime() < maxAge * 7 // Keep for 7 days
      );

      if (memory.conversationHistory.length === 0 && 
          memory.semanticMemory.length === 0 && 
          memory.episodicMemory.length === 0) {
        this.agentMemories.delete(key);
      }
    }
  }

  // Helper methods
  private async prepareAgentContext(
    agent: Agent,
    session: AgentSession,
    memory: AgentMemory,
    currentMessage: string
  ): Promise<any> {
    return {
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        config: agent.config
      },
      session: {
        id: session.sessionId,
        context: session.context,
        metadata: session.metadata
      },
      memory: {
        conversationHistory: memory.conversationHistory.slice(-10),
        relevantSemanticMemory: memory.semanticMemory
          .filter(m => this.isRelevantToMessage(m.concept, currentMessage))
          .slice(0, 5),
        relevantEpisodicMemory: memory.episodicMemory
          .filter(e => this.isRelevantToMessage(e.event, currentMessage))
          .slice(0, 3)
      },
      currentMessage,
      timestamp: new Date()
    };
  }

  private async getAgentTools(toolIds: string[]): Promise<any[]> {
    if (toolIds.length === 0) return [];

    const tools = await this.prisma.tool.findMany({
      where: { id: { in: toolIds } }
    });

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  private async executeToolCalls(toolCalls: any[], organizationId: string): Promise<any[]> {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const tool = await this.prisma.tool.findFirst({
          where: { 
            name: toolCall.function.name,
            organizationId 
          }
        });

        if (!tool) {
          results.push({
            tool_call_id: toolCall.id,
            output: { error: 'Tool not found' }
          });
          continue;
        }

        // Execute tool (simplified)
        const output = await this.executeTool(tool, JSON.parse(toolCall.function.arguments));
        
        results.push({
          tool_call_id: toolCall.id,
          output
        });

      } catch (error) {
        results.push({
          tool_call_id: toolCall.id,
          output: { error: error.message }
        });
      }
    }

    return results;
  }

  private async executeTool(tool: any, args: any): Promise<any> {
    // Simplified tool execution - in production, this would be more sophisticated
    switch (tool.type) {
      case 'FUNCTION_CALLER':
        return this.executeFunctionTool(tool, args);
      case 'REST_API':
        return this.executeRestApiTool(tool, args);
      default:
        return { result: 'Tool executed successfully', args };
    }
  }

  private async executeFunctionTool(tool: any, args: any): Promise<any> {
    // Execute custom function code
    const vm = require('vm');
    const sandbox = { args, result: null };

    try {
      vm.runInNewContext(tool.code, sandbox, { timeout: 5000 });
      return sandbox.result || { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  private async executeRestApiTool(tool: any, args: any): Promise<any> {
    const axios = require('axios');

    try {
      const response = await axios({
        method: tool.config?.method || 'POST',
        url: tool.endpoint,
        data: args,
        headers: {
          'Content-Type': 'application/json',
          ...tool.config?.headers
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      return { error: error.message };
    }
  }

  private shouldUseTool(response: string, context: any): boolean {
    // Simple heuristic to determine if tools should be used
    const toolKeywords = ['search', 'calculate', 'fetch', 'get', 'find', 'lookup', 'query'];
    const lowerResponse = response.toLowerCase();
    
    return toolKeywords.some(keyword => lowerResponse.includes(keyword)) ||
           lowerResponse.includes('i need to') ||
           lowerResponse.includes('let me');
  }

  private combineHybridResponses(conversational: any, tool: any, config: any): any {
    switch (config.hybridStrategy) {
      case 'tool_primary':
        return {
          content: tool.content || conversational.content,
          metadata: { ...conversational.metadata, ...tool.metadata, hybrid: true }
        };
      case 'conversational_primary':
        return {
          content: conversational.content,
          metadata: { ...tool.metadata, ...conversational.metadata, hybrid: true }
        };
      case 'combined':
      default:
        return {
          content: `${conversational.content}\n\n[Tool Result: ${tool.content || 'Tool executed successfully'}]`,
          metadata: { ...conversational.metadata, ...tool.metadata, hybrid: true }
        };
    }
  }

  private async decomposeTask(task: string, agent: Agent): Promise<string[]> {
    // Simple task decomposition - in production, use more sophisticated NLP
    const sentences = task.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 1) {
      return [task];
    }

    // For now, just split by sentences
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  private combineMultiTaskResults(results: any[], config: any): any {
    const combinedContent = results.map(r => r.content).join('\n\n');
    const combinedMetadata = results.reduce((acc, r) => ({ ...acc, ...r.metadata }), {});

    return {
      content: combinedContent,
      metadata: { ...combinedMetadata, multiTask: true, subtasks: results.length }
    };
  }

  private selectBestMultiProviderResponse(results: any[], config: any): any {
    // Filter out errors
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
      return { content: 'All providers failed', metadata: { error: true } };
    }

    // Select based on strategy
    switch (config.selectionStrategy) {
      case 'fastest':
        return validResults.reduce((best, current) => 
          (current.metadata?.duration || 0) < (best.metadata?.duration || Infinity) ? current : best
        );
      case 'longest':
        return validResults.reduce((best, current) => 
          current.content.length > best.content.length ? current : best
        );
      case 'first':
      default:
        return validResults[0];
    }
  }

  private extractConcepts(text: string): string[] {
    // Simple concept extraction - in production, use NLP libraries
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Remove common words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said']);
    
    return [...new Set(words.filter(word => !stopWords.has(word)))].slice(0, 10);
  }

  private isRelevantToMessage(concept: string, message: string): boolean {
    return message.toLowerCase().includes(concept.toLowerCase());
  }

  private calculateImportance(interaction: any): number {
    // Simple importance calculation
    let importance = 1.0;
    
    // Longer interactions are more important
    importance += (interaction.userMessage.length + interaction.agentResponse.length) / 1000;
    
    // Questions are more important
    if (interaction.userMessage.includes('?')) {
      importance += 0.5;
    }
    
    // Tool usage indicates importance
    if (interaction.metadata?.tools_used) {
      importance += 1.0;
    }

    return Math.min(importance, 5.0);
  }

  private async updateAgentStats(agentId: string, duration: number, success: boolean): Promise<void> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return;

    const metadata = agent.metadata as any;
    const totalMessages = (metadata.totalMessages || 0) + 1;
    const avgResponseTime = ((metadata.avgResponseTime || 0) * (totalMessages - 1) + duration) / totalMessages;
    const successCount = (metadata.successCount || 0) + (success ? 1 : 0);
    const successRate = (successCount / totalMessages) * 100;

    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        metadata: {
          ...metadata,
          totalMessages,
          avgResponseTime,
          successCount,
          successRate,
          lastUsed: new Date()
        }
      }
    });
  }

  // Session management
  async getSessions(
    agentId: string,
    organizationId: string,
    options?: {
      status?: SessionStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ sessions: AgentSession[]; total: number }> {
    const agent = await this.getAgent(agentId, organizationId);

    const where: any = { agentId };
    if (options?.status) {
      where.status = options.status;
    }

    const [sessions, total] = await Promise.all([
      this.prisma.agentSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0
      }),
      this.prisma.agentSession.count({ where })
    ]);

    return { sessions, total };
  }

  async endSession(sessionId: string, organizationId: string): Promise<void> {
    const session = await this.prisma.agentSession.findFirst({
      where: { sessionId },
      include: { agent: true }
    });

    if (!session || session.agent.organizationId !== organizationId) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.INACTIVE,
        endedAt: new Date(),
        duration: Date.now() - session.startedAt.getTime()
      }
    });

    // Clean up active session
    this.activeSessions.delete(sessionId);

    await this.apix.publishEvent('agent-events', {
      type: 'SESSION_ENDED',
      agentId: session.agentId,
      sessionId,
      organizationId,
      data: { sessionId, endedAt: new Date() }
    });
  }

  // Analytics
  async getAgentAnalytics(agentId: string, organizationId: string, timeRange: string): Promise<any> {
    const agent = await this.getAgent(agentId, organizationId);

    const dateFilter = this.getDateFilter(timeRange);

    const [
      sessionStats,
      messageStats,
      performanceStats
    ] = await Promise.all([
      this.getSessionStats(agentId, dateFilter),
      this.getMessageStats(agentId, dateFilter),
      this.getPerformanceStats(agentId, dateFilter)
    ]);

    return {
      agent,
      sessionStats,
      messageStats,
      performanceStats,
      timeRange,
      generatedAt: new Date()
    };
  }

  private getDateFilter(timeRange: string): { gte: Date } {
    const now = new Date();
    let daysBack = 7;

    switch (timeRange) {
      case '1d': daysBack = 1; break;
      case '7d': daysBack = 7; break;
      case '30d': daysBack = 30; break;
      case '90d': daysBack = 90; break;
    }

    return {
      gte: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    };
  }

  private async getSessionStats(agentId: string, dateFilter: any): Promise<any> {
    const sessions = await this.prisma.agentSession.findMany({
      where: {
        agentId,
        startedAt: dateFilter
      }
    });

    return {
      total: sessions.length,
      active: sessions.filter(s => s.status === SessionStatus.ACTIVE).length,
      completed: sessions.filter(s => s.status === SessionStatus.INACTIVE).length,
      avgDuration: sessions
        .filter(s => s.duration)
        .reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length || 0
    };
  }

  private async getMessageStats(agentId: string, dateFilter: any): Promise<any> {
    const sessions = await this.prisma.agentSession.findMany({
      where: {
        agentId,
        startedAt: dateFilter
      }
    });

    const totalMessages = sessions.reduce((sum, s) => sum + ((s.messages as any[])?.length || 0), 0);
    const avgMessagesPerSession = sessions.length > 0 ? totalMessages / sessions.length : 0;

    return {
      total: totalMessages,
      avgPerSession: avgMessagesPerSession,
      sessionsWithMessages: sessions.filter(s => ((s.messages as any[])?.length || 0) > 0).length
    };
  }

  private async getPerformanceStats(agentId: string, dateFilter: any): Promise<any> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    const metadata = agent?.metadata as any;

    return {
      avgResponseTime: metadata?.avgResponseTime || 0,
      successRate: metadata?.successRate || 100,
      totalMessages: metadata?.totalMessages || 0,
      lastUsed: metadata?.lastUsed
    };
  }
}