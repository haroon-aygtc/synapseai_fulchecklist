import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { Agent, AgentType, AgentSession, SessionStatus, ExecutionStatus } from '@prisma/client';
import { z } from 'zod';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.nativeEnum(AgentType),
  systemPrompt: z.string().optional(),
  model: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(32000).default(2048),
  tools: z.array(z.string()).default([]),
  skills: z.array(z.any()).default([]),
  config: z.record(z.any()).default({})
});

const UpdateAgentSchema = CreateAgentSchema.partial();

const ExecuteAgentSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  context: z.record(z.any()).default({}),
  stream: z.boolean().default(false)
});

@Injectable()
export class AgentsService {
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async createAgent(userId: string, organizationId: string, data: z.infer<typeof CreateAgentSchema>): Promise<Agent> {
    const validatedData = CreateAgentSchema.parse(data);

    const agent = await this.prisma.agent.create({
      data: {
        ...validatedData,
        userId,
        organizationId,
        skills: validatedData.skills,
        config: validatedData.config
      }
    });

    await this.apix.publishEvent('agent-events', {
      type: 'AGENT_CREATED',
      agentId: agent.id,
      organizationId,
      data: agent
    });

    return agent;
  }

  async getAgents(organizationId: string, filters?: {
    type?: AgentType;
    isActive?: boolean;
    search?: string;
  }): Promise<Agent[]> {
    const where: any = { organizationId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          take: 5,
          orderBy: { lastActivityAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getAgent(id: string, organizationId: string): Promise<Agent> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          orderBy: { lastActivityAt: 'desc' }
        }
      }
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent;
  }

  async updateAgent(id: string, organizationId: string, data: z.infer<typeof UpdateAgentSchema>): Promise<Agent> {
    const validatedData = UpdateAgentSchema.parse(data);

    const existingAgent = await this.prisma.agent.findFirst({
      where: { id, organizationId }
    });

    if (!existingAgent) {
      throw new NotFoundException('Agent not found');
    }

    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...validatedData,
        version: existingAgent.version + 1,
        updatedAt: new Date()
      }
    });

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

    await this.prisma.agent.delete({
      where: { id }
    });

    await this.apix.publishEvent('agent-events', {
      type: 'AGENT_DELETED',
      agentId: id,
      organizationId
    });
  }

  async executeAgent(
    agentId: string,
    organizationId: string,
    data: z.infer<typeof ExecuteAgentSchema>
  ): Promise<{ sessionId: string; response?: string; stream?: AsyncIterable<string> }> {
    const validatedData = ExecuteAgentSchema.parse(data);

    const agent = await this.getAgent(agentId, organizationId);

    let session: AgentSession;

    if (validatedData.sessionId) {
      session = await this.prisma.agentSession.findFirst({
        where: {
          sessionId: validatedData.sessionId,
          agentId,
          status: SessionStatus.ACTIVE
        }
      });

      if (!session) {
        throw new NotFoundException('Session not found or inactive');
      }
    } else {
      session = await this.prisma.agentSession.create({
        data: {
          agentId,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          context: validatedData.context,
          memory: {},
          messages: []
        }
      });
    }

    // Update session activity
    await this.prisma.agentSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() }
    });

    // Get session memory and context
    const sessionMemory = await this.getSessionMemory(session.sessionId);
    const messages = session.messages as any[] || [];

    // Add user message
    messages.push({
      role: 'user',
      content: validatedData.message,
      timestamp: new Date().toISOString()
    });

    try {
      if (validatedData.stream) {
        const stream = this.executeAgentStreaming(agent, messages, sessionMemory, session);
        return { sessionId: session.sessionId, stream };
      } else {
        const response = await this.executeAgentSync(agent, messages, sessionMemory, session);
        return { sessionId: session.sessionId, response };
      }
    } catch (error) {
      await this.apix.publishEvent('agent-events', {
        type: 'AGENT_EXECUTION_ERROR',
        agentId,
        sessionId: session.sessionId,
        organizationId,
        error: error.message
      });
      throw error;
    }
  }

  private async executeAgentSync(
    agent: Agent,
    messages: any[],
    sessionMemory: any,
    session: AgentSession
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(agent, sessionMemory);
    
    let response: string;

    if (agent.model.startsWith('gpt-')) {
      const completion = await this.openai.chat.completions.create({
        model: agent.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: agent.temperature,
        max_tokens: agent.maxTokens
      });

      response = completion.choices[0]?.message?.content || '';
    } else if (agent.model.startsWith('claude-')) {
      const completion = await this.anthropic.messages.create({
        model: agent.model,
        max_tokens: agent.maxTokens,
        temperature: agent.temperature,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      });

      response = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
    } else {
      throw new Error(`Unsupported model: ${agent.model}`);
    }

    // Add assistant response to messages
    messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    // Update session with new messages
    await this.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        messages,
        lastActivityAt: new Date()
      }
    });

    // Update session memory
    await this.updateSessionMemory(session.sessionId, {
      lastMessage: response,
      messageCount: messages.length,
      lastActivity: new Date().toISOString()
    });

    await this.apix.publishEvent('agent-events', {
      type: 'AGENT_RESPONSE',
      agentId: agent.id,
      sessionId: session.sessionId,
      organizationId: agent.organizationId,
      response
    });

    return response;
  }

  private async *executeAgentStreaming(
    agent: Agent,
    messages: any[],
    sessionMemory: any,
    session: AgentSession
  ): AsyncIterable<string> {
    const systemPrompt = this.buildSystemPrompt(agent, sessionMemory);
    
    let fullResponse = '';

    if (agent.model.startsWith('gpt-')) {
      const stream = await this.openai.chat.completions.create({
        model: agent.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          yield content;
        }
      }
    } else if (agent.model.startsWith('claude-')) {
      const stream = await this.anthropic.messages.create({
        model: agent.model,
        max_tokens: agent.maxTokens,
        temperature: agent.temperature,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const content = chunk.delta.text;
          fullResponse += content;
          yield content;
        }
      }
    }

    // Save complete response
    messages.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date().toISOString()
    });

    await this.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        messages,
        lastActivityAt: new Date()
      }
    });

    await this.updateSessionMemory(session.sessionId, {
      lastMessage: fullResponse,
      messageCount: messages.length,
      lastActivity: new Date().toISOString()
    });

    await this.apix.publishEvent('agent-events', {
      type: 'AGENT_RESPONSE_COMPLETE',
      agentId: agent.id,
      sessionId: session.sessionId,
      organizationId: agent.organizationId,
      response: fullResponse
    });
  }

  private buildSystemPrompt(agent: Agent, sessionMemory: any): string {
    let prompt = agent.systemPrompt || 'You are a helpful AI assistant.';
    
    if (sessionMemory && Object.keys(sessionMemory).length > 0) {
      prompt += '\n\nSession Context:\n' + JSON.stringify(sessionMemory, null, 2);
    }

    if (agent.skills && Array.isArray(agent.skills) && agent.skills.length > 0) {
      prompt += '\n\nAvailable Skills:\n' + agent.skills.map((skill: any) => 
        `- ${skill.name}: ${skill.description}`
      ).join('\n');
    }

    return prompt;
  }

  async getSessionMemory(sessionId: string): Promise<any> {
    const memoryKey = `agent_memory:${sessionId}`;
    const memory = await this.redis.get(memoryKey);
    return memory ? JSON.parse(memory) : {};
  }

  async updateSessionMemory(sessionId: string, updates: any): Promise<void> {
    const memoryKey = `agent_memory:${sessionId}`;
    const currentMemory = await this.getSessionMemory(sessionId);
    const updatedMemory = { ...currentMemory, ...updates };
    
    await this.redis.set(memoryKey, JSON.stringify(updatedMemory), 3600); // 1 hour TTL
  }

  async clearSessionMemory(sessionId: string): Promise<void> {
    const memoryKey = `agent_memory:${sessionId}`;
    await this.redis.del(memoryKey);
  }

  async getAgentSessions(agentId: string, organizationId: string): Promise<AgentSession[]> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, organizationId }
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.agentSession.findMany({
      where: { agentId },
      orderBy: { lastActivityAt: 'desc' },
      take: 50
    });
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
        endedAt: new Date()
      }
    });

    await this.clearSessionMemory(sessionId);

    await this.apix.publishEvent('agent-events', {
      type: 'SESSION_ENDED',
      agentId: session.agentId,
      sessionId,
      organizationId
    });
  }

  async getAgentAnalytics(agentId: string, organizationId: string): Promise<any> {
    const agent = await this.getAgent(agentId, organizationId);

    const totalSessions = await this.prisma.agentSession.count({
      where: { agentId }
    });

    const activeSessions = await this.prisma.agentSession.count({
      where: { agentId, status: SessionStatus.ACTIVE }
    });

    const avgSessionDuration = await this.prisma.agentSession.aggregate({
      where: { agentId, endedAt: { not: null } },
      _avg: {
        duration: true
      }
    });

    return {
      agent,
      totalSessions,
      activeSessions,
      avgSessionDuration: avgSessionDuration._avg.duration || 0,
      lastActivity: agent.updatedAt
    };
  }
}