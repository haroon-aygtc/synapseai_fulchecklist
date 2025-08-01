import { ApixEvent, ApixChannel, ApixEventType, APIX_CHANNELS } from './types';

/**
 * Event factory functions for creating standardized APIX events
 */

export class ApixEventFactory {
  private static generateId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static createBaseEvent(
    type: ApixEventType,
    channel: ApixChannel,
    data: any,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return {
      id: this.generateId(),
      type,
      channel,
      data,
      metadata: {
        timestamp: new Date(),
        source: 'apix-event-factory',
        version: '1.0.0',
        ...metadata
      },
      priority: 'normal'
    };
  }

  // Agent Events
  static agentCreated(agentData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('AGENT_CREATED', APIX_CHANNELS.AGENT_EVENTS, agentData, metadata);
  }

  static agentUpdated(agentData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('AGENT_UPDATED', APIX_CHANNELS.AGENT_EVENTS, agentData, metadata);
  }

  static agentDeleted(agentId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('AGENT_DELETED', APIX_CHANNELS.AGENT_EVENTS, { agentId }, metadata);
  }

  static agentStarted(agentId: string, sessionId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('AGENT_STARTED', APIX_CHANNELS.AGENT_EVENTS, { agentId, sessionId }, {
      ...metadata,
      sessionId
    });
  }

  static agentStopped(agentId: string, sessionId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('AGENT_STOPPED', APIX_CHANNELS.AGENT_EVENTS, { agentId, sessionId }, {
      ...metadata,
      sessionId
    });
  }

  static agentMessage(
    agentId: string,
    message: string,
    sessionId: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('AGENT_MESSAGE', APIX_CHANNELS.AGENT_EVENTS, {
      agentId,
      message,
      sessionId
    }, {
      ...metadata,
      sessionId
    });
  }

  static agentError(
    agentId: string,
    error: string,
    sessionId?: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('AGENT_ERROR', APIX_CHANNELS.AGENT_EVENTS, {
      agentId,
      error,
      sessionId
    }, {
      ...metadata,
      sessionId
    });
  }

  // Streaming Events
  static agentStreamStart(
    agentId: string,
    streamId: string,
    sessionId: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return {
      ...this.createBaseEvent('AGENT_STREAM_START', APIX_CHANNELS.STREAMING, {
        agentId,
        sessionId
      }, {
        ...metadata,
        sessionId
      }),
      streamId
    };
  }

  static agentStreamChunk(
    agentId: string,
    streamId: string,
    chunkData: any,
    chunkIndex: number,
    totalChunks: number,
    sessionId: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return {
      ...this.createBaseEvent('AGENT_STREAM_CHUNK', APIX_CHANNELS.STREAMING, {
        agentId,
        sessionId,
        chunk: chunkData
      }, {
        ...metadata,
        sessionId
      }),
      streamId,
      chunkIndex,
      totalChunks
    };
  }

  static agentStreamEnd(
    agentId: string,
    streamId: string,
    sessionId: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return {
      ...this.createBaseEvent('AGENT_STREAM_END', APIX_CHANNELS.STREAMING, {
        agentId,
        sessionId
      }, {
        ...metadata,
        sessionId
      }),
      streamId,
      isStreamEnd: true
    };
  }

  // Tool Events
  static toolCreated(toolData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('TOOL_CREATED', APIX_CHANNELS.TOOL_EVENTS, toolData, metadata);
  }

  static toolUpdated(toolData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('TOOL_UPDATED', APIX_CHANNELS.TOOL_EVENTS, toolData, metadata);
  }

  static toolDeleted(toolId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('TOOL_DELETED', APIX_CHANNELS.TOOL_EVENTS, { toolId }, metadata);
  }

  static toolExecuted(
    toolId: string,
    input: any,
    output: any,
    executionTime: number,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('TOOL_EXECUTED', APIX_CHANNELS.TOOL_EVENTS, {
      toolId,
      input,
      output,
      executionTime
    }, metadata);
  }

  static toolError(
    toolId: string,
    error: string,
    input?: any,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('TOOL_ERROR', APIX_CHANNELS.TOOL_EVENTS, {
      toolId,
      error,
      input
    }, metadata);
  }

  // Workflow Events
  static workflowCreated(workflowData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('WORKFLOW_CREATED', APIX_CHANNELS.WORKFLOW_EVENTS, workflowData, metadata);
  }

  static workflowUpdated(workflowData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('WORKFLOW_UPDATED', APIX_CHANNELS.WORKFLOW_EVENTS, workflowData, metadata);
  }

  static workflowDeleted(workflowId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('WORKFLOW_DELETED', APIX_CHANNELS.WORKFLOW_EVENTS, { workflowId }, metadata);
  }

  static workflowStarted(
    workflowId: string,
    executionId: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('WORKFLOW_STARTED', APIX_CHANNELS.WORKFLOW_EVENTS, {
      workflowId,
      executionId
    }, metadata);
  }

  static workflowCompleted(
    workflowId: string,
    executionId: string,
    result: any,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('WORKFLOW_COMPLETED', APIX_CHANNELS.WORKFLOW_EVENTS, {
      workflowId,
      executionId,
      result
    }, metadata);
  }

  static workflowFailed(
    workflowId: string,
    executionId: string,
    error: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('WORKFLOW_FAILED', APIX_CHANNELS.WORKFLOW_EVENTS, {
      workflowId,
      executionId,
      error
    }, metadata);
  }

  static workflowNodeExecuted(
    workflowId: string,
    executionId: string,
    nodeId: string,
    nodeResult: any,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('WORKFLOW_NODE_EXECUTED', APIX_CHANNELS.WORKFLOW_EVENTS, {
      workflowId,
      executionId,
      nodeId,
      nodeResult
    }, metadata);
  }

  // Provider Events
  static providerConnected(providerId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('PROVIDER_CONNECTED', APIX_CHANNELS.PROVIDER_EVENTS, { providerId }, metadata);
  }

  static providerDisconnected(providerId: string, reason?: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('PROVIDER_DISCONNECTED', APIX_CHANNELS.PROVIDER_EVENTS, {
      providerId,
      reason
    }, metadata);
  }

  static providerError(providerId: string, error: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('PROVIDER_ERROR', APIX_CHANNELS.PROVIDER_EVENTS, {
      providerId,
      error
    }, metadata);
  }

  static providerRateLimited(
    providerId: string,
    limit: number,
    resetTime: Date,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('PROVIDER_RATE_LIMITED', APIX_CHANNELS.PROVIDER_EVENTS, {
      providerId,
      limit,
      resetTime
    }, metadata);
  }

  static providerFallback(
    fromProviderId: string,
    toProviderId: string,
    reason: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('PROVIDER_FALLBACK', APIX_CHANNELS.PROVIDER_EVENTS, {
      fromProviderId,
      toProviderId,
      reason
    }, metadata);
  }

  // System Events
  static systemStartup(version: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('SYSTEM_STARTUP', APIX_CHANNELS.SYSTEM_EVENTS, { version }, metadata);
  }

  static systemShutdown(reason?: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('SYSTEM_SHUTDOWN', APIX_CHANNELS.SYSTEM_EVENTS, { reason }, metadata);
  }

  static systemError(error: string, stack?: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('SYSTEM_ERROR', APIX_CHANNELS.SYSTEM_EVENTS, {
      error,
      stack
    }, {
      ...metadata,
      priority: 'high'
    } as any);
  }

  static systemHealthCheck(
    status: 'healthy' | 'degraded' | 'unhealthy',
    checks: Record<string, boolean>,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('SYSTEM_HEALTH_CHECK', APIX_CHANNELS.SYSTEM_EVENTS, {
      status,
      checks
    }, metadata);
  }

  // User Events
  static userConnected(userId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('USER_CONNECTED', APIX_CHANNELS.USER_EVENTS, { userId }, {
      ...metadata,
      userId
    });
  }

  static userDisconnected(userId: string, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('USER_DISCONNECTED', APIX_CHANNELS.USER_EVENTS, { userId }, {
      ...metadata,
      userId
    });
  }

  static userAction(
    userId: string,
    action: string,
    actionData: any,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('USER_ACTION', APIX_CHANNELS.USER_EVENTS, {
      userId,
      action,
      actionData
    }, {
      ...metadata,
      userId
    });
  }

  // Organization Events
  static orgCreated(orgData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('ORG_CREATED', APIX_CHANNELS.ORGANIZATION_EVENTS, orgData, metadata);
  }

  static orgUpdated(orgData: any, metadata?: Partial<ApixEvent['metadata']>): ApixEvent {
    return this.createBaseEvent('ORG_UPDATED', APIX_CHANNELS.ORGANIZATION_EVENTS, orgData, metadata);
  }

  static orgUserAdded(
    orgId: string,
    userId: string,
    role: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('ORG_USER_ADDED', APIX_CHANNELS.ORGANIZATION_EVENTS, {
      orgId,
      userId,
      role
    }, {
      ...metadata,
      organizationId: orgId,
      userId
    });
  }

  static orgUserRemoved(
    orgId: string,
    userId: string,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('ORG_USER_REMOVED', APIX_CHANNELS.ORGANIZATION_EVENTS, {
      orgId,
      userId
    }, {
      ...metadata,
      organizationId: orgId,
      userId
    });
  }

  // Custom Events
  static customEvent(
    type: string,
    channel: ApixChannel,
    data: any,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent(type as ApixEventType, channel, data, metadata);
  }

  static broadcast(
    channel: ApixChannel,
    data: any,
    metadata?: Partial<ApixEvent['metadata']>
  ): ApixEvent {
    return this.createBaseEvent('BROADCAST', channel, data, metadata);
  }
}

/**
 * Event validation utilities
 */
export class ApixEventValidator {
  static isValidEvent(event: any): event is ApixEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      typeof event.id === 'string' &&
      typeof event.type === 'string' &&
      typeof event.channel === 'string' &&
      event.data !== undefined &&
      typeof event.metadata === 'object' &&
      event.metadata !== null &&
      event.metadata.timestamp instanceof Date &&
      typeof event.metadata.source === 'string' &&
      ['low', 'normal', 'high', 'critical'].includes(event.priority)
    );
  }

  static validateEventType(type: string): type is ApixEventType {
    const validTypes = [
      'AGENT_CREATED', 'AGENT_UPDATED', 'AGENT_DELETED', 'AGENT_STARTED', 'AGENT_STOPPED',
      'AGENT_MESSAGE', 'AGENT_ERROR', 'AGENT_STREAM_START', 'AGENT_STREAM_CHUNK', 'AGENT_STREAM_END',
      'TOOL_CREATED', 'TOOL_UPDATED', 'TOOL_DELETED', 'TOOL_EXECUTED', 'TOOL_ERROR',
      'TOOL_STREAM_START', 'TOOL_STREAM_CHUNK', 'TOOL_STREAM_END',
      'WORKFLOW_CREATED', 'WORKFLOW_UPDATED', 'WORKFLOW_DELETED', 'WORKFLOW_STARTED',
      'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED', 'WORKFLOW_PAUSED', 'WORKFLOW_RESUMED',
      'WORKFLOW_NODE_EXECUTED', 'WORKFLOW_NODE_FAILED',
      'PROVIDER_CONNECTED', 'PROVIDER_DISCONNECTED', 'PROVIDER_ERROR', 'PROVIDER_RATE_LIMITED', 'PROVIDER_FALLBACK',
      'SYSTEM_STARTUP', 'SYSTEM_SHUTDOWN', 'SYSTEM_ERROR', 'SYSTEM_HEALTH_CHECK', 'SYSTEM_MAINTENANCE',
      'USER_CONNECTED', 'USER_DISCONNECTED', 'USER_ACTION',
      'ORG_CREATED', 'ORG_UPDATED', 'ORG_DELETED', 'ORG_USER_ADDED', 'ORG_USER_REMOVED',
      'CUSTOM_EVENT', 'BROADCAST', 'STREAM_DATA'
    ];
    
    return validTypes.includes(type);
  }

  static validateChannel(channel: string): channel is ApixChannel {
    return Object.values(APIX_CHANNELS).includes(channel as ApixChannel);
  }
}

/**
 * Event filtering utilities
 */
export class ApixEventFilter {
  static byType(events: ApixEvent[], type: ApixEventType): ApixEvent[] {
    return events.filter(event => event.type === type);
  }

  static byChannel(events: ApixEvent[], channel: ApixChannel): ApixEvent[] {
    return events.filter(event => event.channel === channel);
  }

  static byUserId(events: ApixEvent[], userId: string): ApixEvent[] {
    return events.filter(event => event.metadata.userId === userId);
  }

  static byOrganizationId(events: ApixEvent[], organizationId: string): ApixEvent[] {
    return events.filter(event => event.metadata.organizationId === organizationId);
  }

  static bySessionId(events: ApixEvent[], sessionId: string): ApixEvent[] {
    return events.filter(event => event.metadata.sessionId === sessionId);
  }

  static byTimeRange(events: ApixEvent[], start: Date, end: Date): ApixEvent[] {
    return events.filter(event => 
      event.metadata.timestamp >= start && event.metadata.timestamp <= end
    );
  }

  static byPriority(events: ApixEvent[], priority: ApixEvent['priority']): ApixEvent[] {
    return events.filter(event => event.priority === priority);
  }

  static recent(events: ApixEvent[], minutes: number = 5): ApixEvent[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return events.filter(event => event.metadata.timestamp >= cutoff);
  }

  static sortByTimestamp(events: ApixEvent[], ascending = false): ApixEvent[] {
    return [...events].sort((a, b) => {
      const timeA = a.metadata.timestamp.getTime();
      const timeB = b.metadata.timestamp.getTime();
      return ascending ? timeA - timeB : timeB - timeA;
    });
  }
}