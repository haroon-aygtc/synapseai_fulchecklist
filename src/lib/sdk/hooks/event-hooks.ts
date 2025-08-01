import { useEffect, useRef, useState, useCallback } from 'react';
import { SDKEventSystem, SDKEvent, EventSubscription } from '../events/event-system';
import { ApixChannel } from '../../apix/types';

export interface UseEventSystemOptions {
  autoConnect?: boolean;
  componentId?: string;
}

export function useEventSystem(
  eventSystem: SDKEventSystem,
  options: UseEventSystemOptions = {}
): {
  isConnected: boolean;
  connectionStatus: string;
  subscriptionCount: number;
  publish: (event: Partial<SDKEvent> & { type: string }) => Promise<string>;
  subscribe: <T extends SDKEvent>(
    eventType: string,
    handler: (event: T) => void,
    subscribeOptions?: {
      channel?: ApixChannel;
      filters?: Record<string, any>;
      once?: boolean;
    }
  ) => () => void;
  broadcast: (eventType: string, data: any) => Promise<string>;
} {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const subscriptionsRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    if (options.autoConnect !== false) {
      eventSystem.initialize().then(() => {
        setIsConnected(true);
        setConnectionStatus(eventSystem.getConnectionStatus());
      });
    }

    // Subscribe to connection status changes
    const unsubscribe = eventSystem.subscribe(
      'SDK_CONNECTION_STATUS_CHANGE',
      (event) => {
        setConnectionStatus(event.data.status);
        setIsConnected(event.data.status === 'connected');
      }
    );

    subscriptionsRef.current.add(unsubscribe);

    return () => {
      // Clean up all subscriptions
      subscriptionsRef.current.forEach(unsub => unsub());
      subscriptionsRef.current.clear();
    };
  }, [eventSystem, options.autoConnect]);

  const publish = useCallback(
    async (event: Partial<SDKEvent> & { type: string }) => {
      return eventSystem.publish(event);
    },
    [eventSystem]
  );

  const subscribe = useCallback(
    <T extends SDKEvent>(
      eventType: string,
      handler: (event: T) => void,
      subscribeOptions?: {
        channel?: ApixChannel;
        filters?: Record<string, any>;
        once?: boolean;
      }
    ) => {
      const unsubscribe = eventSystem.subscribe(eventType, handler, subscribeOptions);
      subscriptionsRef.current.add(unsubscribe);
      setSubscriptionCount(subscriptionsRef.current.size);

      return () => {
        unsubscribe();
        subscriptionsRef.current.delete(unsubscribe);
        setSubscriptionCount(subscriptionsRef.current.size);
      };
    },
    [eventSystem]
  );

  const broadcast = useCallback(
    async (eventType: string, data: any) => {
      return eventSystem.broadcast(eventType, data);
    },
    [eventSystem]
  );

  return {
    isConnected,
    connectionStatus,
    subscriptionCount,
    publish,
    subscribe,
    broadcast
  };
}

export function useEventSubscription<T extends SDKEvent = SDKEvent>(
  eventSystem: SDKEventSystem,
  eventType: string,
  handler: (event: T) => void,
  options?: {
    channel?: ApixChannel;
    filters?: Record<string, any>;
    dependencies?: any[];
    enabled?: boolean;
  }
): {
  isSubscribed: boolean;
  lastEvent: T | null;
  eventCount: number;
} {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastEvent, setLastEvent] = useState<T | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const handlerRef = useRef(handler);
  const enabled = options?.enabled !== false;

  // Update handler ref
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) {
      setIsSubscribed(false);
      return;
    }

    const wrappedHandler = (event: T) => {
      setLastEvent(event);
      setEventCount(prev => prev + 1);
      handlerRef.current(event);
    };

    const unsubscribe = eventSystem.subscribe(eventType, wrappedHandler, {
      channel: options?.channel,
      filters: options?.filters
    });

    setIsSubscribed(true);

    return () => {
      unsubscribe();
      setIsSubscribed(false);
    };
  }, [eventSystem, eventType, options?.channel, options?.filters, enabled, ...(options?.dependencies || [])]);

  return {
    isSubscribed,
    lastEvent,
    eventCount
  };
}

export function useEventPublisher(
  eventSystem: SDKEventSystem
): {
  publish: (event: Partial<SDKEvent> & { type: string }) => Promise<string>;
  publishToComponent: (targetComponentId: string, eventType: string, data: any) => Promise<string>;
  broadcast: (eventType: string, data: any, options?: { channel?: ApixChannel }) => Promise<string>;
  publishAgentCollaboration: (
    eventType: 'COLLABORATION_REQUEST' | 'COLLABORATION_RESPONSE' | 'COLLABORATION_MESSAGE' | 'COLLABORATION_END',
    data: {
      fromAgentId: string;
      toAgentId?: string;
      collaborationId?: string;
      message?: string;
      context?: any;
    }
  ) => Promise<string>;
  publishToolExecution: (
    eventType: 'TOOL_EXECUTION_START' | 'TOOL_EXECUTION_PROGRESS' | 'TOOL_EXECUTION_COMPLETE' | 'TOOL_EXECUTION_ERROR',
    data: {
      toolId: string;
      executionId: string;
      agentId?: string;
      workflowId?: string;
      input?: any;
      output?: any;
      error?: string;
      progress?: number;
    }
  ) => Promise<string>;
  publishWorkflow: (
    eventType: 'WORKFLOW_NODE_EXECUTED' | 'WORKFLOW_PROGRESS' | 'WORKFLOW_STATE_CHANGE',
    data: {
      workflowId: string;
      nodeId?: string;
      executionId: string;
      state?: string;
      progress?: number;
      result?: any;
      error?: string;
    }
  ) => Promise<string>;
} {
  const publish = useCallback(
    async (event: Partial<SDKEvent> & { type: string }) => {
      return eventSystem.publish(event);
    },
    [eventSystem]
  );

  const publishToComponent = useCallback(
    async (targetComponentId: string, eventType: string, data: any) => {
      return eventSystem.publishToComponent(targetComponentId, eventType, data);
    },
    [eventSystem]
  );

  const broadcast = useCallback(
    async (eventType: string, data: any, options?: { channel?: ApixChannel }) => {
      return eventSystem.broadcast(eventType, data, options);
    },
    [eventSystem]
  );

  const publishAgentCollaboration = useCallback(
    async (
      eventType: 'COLLABORATION_REQUEST' | 'COLLABORATION_RESPONSE' | 'COLLABORATION_MESSAGE' | 'COLLABORATION_END',
      data: {
        fromAgentId: string;
        toAgentId?: string;
        collaborationId?: string;
        message?: string;
        context?: any;
      }
    ) => {
      return eventSystem.publishAgentCollaborationEvent(eventType, data);
    },
    [eventSystem]
  );

  const publishToolExecution = useCallback(
    async (
      eventType: 'TOOL_EXECUTION_START' | 'TOOL_EXECUTION_PROGRESS' | 'TOOL_EXECUTION_COMPLETE' | 'TOOL_EXECUTION_ERROR',
      data: {
        toolId: string;
        executionId: string;
        agentId?: string;
        workflowId?: string;
        input?: any;
        output?: any;
        error?: string;
        progress?: number;
      }
    ) => {
      return eventSystem.publishToolExecutionEvent(eventType, data);
    },
    [eventSystem]
  );

  const publishWorkflow = useCallback(
    async (
      eventType: 'WORKFLOW_NODE_EXECUTED' | 'WORKFLOW_PROGRESS' | 'WORKFLOW_STATE_CHANGE',
      data: {
        workflowId: string;
        nodeId?: string;
        executionId: string;
        state?: string;
        progress?: number;
        result?: any;
        error?: string;
      }
    ) => {
      return eventSystem.publishWorkflowEvent(eventType, data);
    },
    [eventSystem]
  );

  return {
    publish,
    publishToComponent,
    broadcast,
    publishAgentCollaboration,
    publishToolExecution,
    publishWorkflow
  };
}

export function useEventHistory(
  eventSystem: SDKEventSystem,
  filters?: {
    eventType?: string;
    channel?: ApixChannel;
    componentId?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
  }
): {
  events: SDKEvent[];
  refresh: () => void;
  replay: (events?: SDKEvent[], options?: { delay?: number; skipErrors?: boolean }) => Promise<void>;
} {
  const [events, setEvents] = useState<SDKEvent[]>([]);

  const refresh = useCallback(() => {
    const history = eventSystem.getEventHistory(filters);
    setEvents(history);
  }, [eventSystem, filters]);

  const replay = useCallback(
    async (eventsToReplay?: SDKEvent[], options?: { delay?: number; skipErrors?: boolean }) => {
      const targetEvents = eventsToReplay || events;
      await eventSystem.replayEvents(targetEvents, options);
    },
    [eventSystem, events]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    events,
    refresh,
    replay
  };
}

export function useAgentCollaboration(
  eventSystem: SDKEventSystem,
  agentId: string
): {
  collaborations: Map<string, any>;
  initiateCollaboration: (collaboratorIds: string[], context: any) => Promise<string>;
  sendMessage: (collaborationId: string, toAgentId: string, message: string) => Promise<void>;
  endCollaboration: (collaborationId: string) => Promise<void>;
  onCollaborationRequest: (handler: (data: any) => void) => () => void;
  onCollaborationMessage: (handler: (data: any) => void) => () => void;
} {
  const [collaborations, setCollaborations] = useState<Map<string, any>>(new Map());

  const initiateCollaboration = useCallback(
    async (collaboratorIds: string[], context: any) => {
      const collaborationId = `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await eventSystem.publishAgentCollaborationEvent('COLLABORATION_REQUEST', {
        fromAgentId: agentId,
        collaborationId,
        context,
        metadata: { collaboratorIds }
      });

      setCollaborations(prev => new Map(prev.set(collaborationId, {
        id: collaborationId,
        initiator: agentId,
        collaborators: [agentId, ...collaboratorIds],
        context,
        messages: [],
        status: 'active',
        createdAt: new Date()
      })));

      return collaborationId;
    },
    [eventSystem, agentId]
  );

  const sendMessage = useCallback(
    async (collaborationId: string, toAgentId: string, message: string) => {
      await eventSystem.publishAgentCollaborationEvent('COLLABORATION_MESSAGE', {
        fromAgentId: agentId,
        toAgentId,
        collaborationId,
        message
      });

      setCollaborations(prev => {
        const updated = new Map(prev);
        const collaboration = updated.get(collaborationId);
        if (collaboration) {
          collaboration.messages.push({
            from: agentId,
            to: toAgentId,
            message,
            timestamp: new Date()
          });
          updated.set(collaborationId, collaboration);
        }
        return updated;
      });
    },
    [eventSystem, agentId]
  );

  const endCollaboration = useCallback(
    async (collaborationId: string) => {
      await eventSystem.publishAgentCollaborationEvent('COLLABORATION_END', {
        fromAgentId: agentId,
        collaborationId
      });

      setCollaborations(prev => {
        const updated = new Map(prev);
        const collaboration = updated.get(collaborationId);
        if (collaboration) {
          collaboration.status = 'ended';
          collaboration.endedAt = new Date();
          updated.set(collaborationId, collaboration);
        }
        return updated;
      });
    },
    [eventSystem, agentId]
  );

  const onCollaborationRequest = useCallback(
    (handler: (data: any) => void) => {
      return eventSystem.subscribe(
        'COLLABORATION_REQUEST',
        (event) => {
          if (event.data.metadata?.collaboratorIds?.includes(agentId)) {
            handler(event.data);
          }
        },
        { channel: 'agent-events' }
      );
    },
    [eventSystem, agentId]
  );

  const onCollaborationMessage = useCallback(
    (handler: (data: any) => void) => {
      return eventSystem.subscribe(
        'COLLABORATION_MESSAGE',
        (event) => {
          if (event.data.toAgentId === agentId) {
            handler(event.data);
            
            // Update local collaboration state
            setCollaborations(prev => {
              const updated = new Map(prev);
              const collaboration = updated.get(event.data.collaborationId);
              if (collaboration) {
                collaboration.messages.push({
                  from: event.data.fromAgentId,
                  to: event.data.toAgentId,
                  message: event.data.message,
                  timestamp: new Date()
                });
                updated.set(event.data.collaborationId, collaboration);
              }
              return updated;
            });
          }
        },
        { channel: 'agent-events' }
      );
    },
    [eventSystem, agentId]
  );

  return {
    collaborations,
    initiateCollaboration,
    sendMessage,
    endCollaboration,
    onCollaborationRequest,
    onCollaborationMessage
  };
}

export function useToolExecutionMonitoring(
  eventSystem: SDKEventSystem,
  toolId?: string
): {
  executions: Map<string, any>;
  activeExecutions: any[];
  completedExecutions: any[];
  failedExecutions: any[];
  onExecutionStart: (handler: (data: any) => void) => () => void;
  onExecutionProgress: (handler: (data: any) => void) => () => void;
  onExecutionComplete: (handler: (data: any) => void) => () => void;
  onExecutionError: (handler: (data: any) => void) => () => void;
} {
  const [executions, setExecutions] = useState<Map<string, any>>(new Map());

  const updateExecution = useCallback((executionId: string, updates: any) => {
    setExecutions(prev => {
      const updated = new Map(prev);
      const existing = updated.get(executionId) || {};
      updated.set(executionId, { ...existing, ...updates });
      return updated;
    });
  }, []);

  const onExecutionStart = useCallback(
    (handler: (data: any) => void) => {
      return eventSystem.subscribe(
        'TOOL_EXECUTION_START',
        (event) => {
          if (!toolId || event.data.toolId === toolId) {
            updateExecution(event.data.executionId, {
              id: event.data.executionId,
              toolId: event.data.toolId,
              agentId: event.data.agentId,
              workflowId: event.data.workflowId,
              input: event.data.input,
              status: 'running',
              startedAt: new Date(),
              progress: 0
            });
            handler(event.data);
          }
        },
        { channel: 'tool-events' }
      );
    },
    [eventSystem, toolId, updateExecution]
  );

  const onExecutionProgress = useCallback(
    (handler: (data: any) => void) => {
      return eventSystem.subscribe(
        'TOOL_EXECUTION_PROGRESS',
        (event) => {
          if (!toolId || event.data.toolId === toolId) {
            updateExecution(event.data.executionId, {
              progress: event.data.progress,
              lastProgressAt: new Date()
            });
            handler(event.data);
          }
        },
        { channel: 'tool-events' }
      );
    },
    [eventSystem, toolId, updateExecution]
  );

  const onExecutionComplete = useCallback(
    (handler: (data: any) => void) => {
      return eventSystem.subscribe(
        'TOOL_EXECUTION_COMPLETE',
        (event) => {
          if (!toolId || event.data.toolId === toolId) {
            updateExecution(event.data.executionId, {
              output: event.data.output,
              status: 'completed',
              completedAt: new Date(),
              progress: 100
            });
            handler(event.data);
          }
        },
        { channel: 'tool-events' }
      );
    },
    [eventSystem, toolId, updateExecution]
  );

  const onExecutionError = useCallback(
    (handler: (data: any) => void) => {
      return eventSystem.subscribe(
        'TOOL_EXECUTION_ERROR',
        (event) => {
          if (!toolId || event.data.toolId === toolId) {
            updateExecution(event.data.executionId, {
              error: event.data.error,
              status: 'failed',
              failedAt: new Date()
            });
            handler(event.data);
          }
        },
        { channel: 'tool-events' }
      );
    },
    [eventSystem, toolId, updateExecution]
  );

  const executionsList = Array.from(executions.values());
  const activeExecutions = executionsList.filter(e => e.status === 'running');
  const completedExecutions = executionsList.filter(e => e.status === 'completed');
  const failedExecutions = executionsList.filter(e => e.status === 'failed');

  return {
    executions,
    activeExecutions,
    completedExecutions,
    failedExecutions,
    onExecutionStart,
    onExecutionProgress,
    onExecutionComplete,
    onExecutionError
  };
}