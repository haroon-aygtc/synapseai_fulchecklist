/**
 * APIX Protocol - React Hooks
 * 
 * This file provides React hooks for using the APIX client in components.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { apixClient, ApixClient } from './client';
import {
  ApixEvent,
  ConnectionStatus,
  EventHandler,
  SubscriptionOptions,
  ApixChannel,
  ApixEventType,
  ApixMetrics,
  APIX_CHANNELS
} from './types';
import { useApixContext } from './context';

/**
 * Hook to access the APIX client instance
 */
export function useApixClient(): ApixClient {
  return apixClient;
}

/**
 * Hook to subscribe to APIX events
 */
export function useApixEvents<T extends ApixEvent = ApixEvent>(
  options: SubscriptionOptions = {},
  dependencies: any[] = []
): T[] {
  const client = useApixClient();
  const [events, setEvents] = useState<T[]>([]);

  useEffect(() => {
    // Clear events when dependencies change
    setEvents([]);

    // Subscribe to events
    const handler: EventHandler<T> = (event) => {
      setEvents(prev => {
        const newEvents = [...prev, event];
        // Keep only the last 100 events to prevent memory issues
        return newEvents.slice(-100);
      });
    };

    const unsubscribe = client.subscribe<T>(handler, options);

    // Load history if requested
    if (options.includeHistory) {
      const history = client.getEventHistory(options.channel, options.historyLimit || 50);
      const filteredHistory = history.filter(event => {
        if (options.eventType && event.type !== options.eventType) return false;
        if (options.filters) {
          for (const [key, value] of Object.entries(options.filters)) {
            if (key === 'type' && event.type !== value) return false;
            if (key === 'userId' && event.metadata.userId !== value) return false;
            if (key === 'organizationId' && event.metadata.organizationId !== value) return false;
          }
        }
        return true;
      }) as T[];
      
      setEvents(filteredHistory);
    }

    // Cleanup subscription
    return () => {
      unsubscribe();
    };
  }, [...dependencies, JSON.stringify(options)]);

  return events;
}

/**
 * Hook to subscribe to the latest APIX event
 */
export function useLatestApixEvent<T extends ApixEvent = ApixEvent>(
  options: SubscriptionOptions = {},
  dependencies: any[] = []
): T | null {
  const client = useApixClient();
  const [latestEvent, setLatestEvent] = useState<T | null>(null);

  useEffect(() => {
    // Reset when dependencies change
    setLatestEvent(null);

    // Subscribe to events
    const handler: EventHandler<T> = (event) => {
      setLatestEvent(event);
    };

    const unsubscribe = client.subscribe<T>(handler, options);

    // Cleanup subscription
    return () => {
      unsubscribe();
    };
  }, [...dependencies, JSON.stringify(options)]);

  return latestEvent;
}

/**
 * Hook to publish APIX events
 */
export function useApixPublish() {
  const client = useApixClient();

  const publish = useCallback(<T extends ApixEvent>(
    event: Partial<T> & { type: T['type']; channel: T['channel'] }
  ): string => {
    return client.publish<T>(event);
  }, [client]);

  return publish;
}

/**
 * Hook to monitor APIX connection status
 */
export function useApixStatus(): ConnectionStatus {
  const client = useApixClient();
  const [status, setStatus] = useState<ConnectionStatus>(client.getStatus());

  useEffect(() => {
    const unsubscribe = client.onStatusChange(setStatus);
    return unsubscribe;
  }, [client]);

  return status;
}

/**
 * Hook to manage APIX connection
 */
export function useApixConnection(autoConnect = false) {
  const client = useApixClient();
  const status = useApixStatus();

  const connect = useCallback(async (token?: string, organizationId?: string) => {
    try {
      await client.connect(token, organizationId);
      return true;
    } catch (error) {
      console.error('Failed to connect to APIX:', error);
      return false;
    }
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && status === 'disconnected') {
      // Note: Auto-connect requires token to be provided elsewhere
      // This is typically handled by the ApixProvider
    }
  }, [autoConnect, status]);

  return {
    status,
    connect,
    disconnect,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isReconnecting: status === 'reconnecting',
    hasError: status === 'error'
  };
}

/**
 * Hook to join and leave APIX rooms
 */
export function useApixRoom(roomId: string | null) {
  const client = useApixClient();
  const { isConnected } = useApixConnection();
  const [isInRoom, setIsInRoom] = useState(false);

  useEffect(() => {
    if (!roomId || !isConnected) {
      setIsInRoom(false);
      return;
    }

    // Join room
    client.joinRoom(roomId)
      .then(() => setIsInRoom(true))
      .catch(console.error);

    // Leave room on cleanup
    return () => {
      if (roomId) {
        client.leaveRoom(roomId)
          .then(() => setIsInRoom(false))
          .catch(console.error);
      }
    };
  }, [client, roomId, isConnected]);

  return {
    isConnected,
    isInRoom,
    roomId
  };
}

/**
 * Hook to create a subscription options object
 */
export function useApixSubscriptionOptions(
  options: SubscriptionOptions = {}
): SubscriptionOptions {
  return useMemo(() => options, [JSON.stringify(options)]);
}

/**
 * Hook to subscribe to agent events
 */
export function useAgentEvents(
  filters?: Record<string, any>,
  includeHistory = false
) {
  const options = useApixSubscriptionOptions({
    channel: APIX_CHANNELS.AGENT_EVENTS,
    filters,
    includeHistory,
    historyLimit: 50
  });

  return useApixEvents(options);
}

/**
 * Hook to subscribe to tool events
 */
export function useToolEvents(
  filters?: Record<string, any>,
  includeHistory = false
) {
  const options = useApixSubscriptionOptions({
    channel: APIX_CHANNELS.TOOL_EVENTS,
    filters,
    includeHistory,
    historyLimit: 50
  });

  return useApixEvents(options);
}

/**
 * Hook to subscribe to workflow events
 */
export function useWorkflowEvents(
  filters?: Record<string, any>,
  includeHistory = false
) {
  const options = useApixSubscriptionOptions({
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    filters,
    includeHistory,
    historyLimit: 50
  });

  return useApixEvents(options);
}

/**
 * Hook to subscribe to system events
 */
export function useSystemEvents(
  filters?: Record<string, any>,
  includeHistory = false
) {
  const options = useApixSubscriptionOptions({
    channel: APIX_CHANNELS.SYSTEM_EVENTS,
    filters,
    includeHistory,
    historyLimit: 50
  });

  return useApixEvents(options);
}

/**
 * Hook to subscribe to streaming events
 */
export function useStreamingEvents(
  streamId?: string,
  includeHistory = false
) {
  const filters = streamId ? { streamId } : undefined;
  
  const options = useApixSubscriptionOptions({
    channel: APIX_CHANNELS.STREAMING,
    filters,
    includeHistory,
    historyLimit: 100
  });

  return useApixEvents(options);
}

/**
 * Hook to get APIX metrics
 */
export function useApixMetrics(): ApixMetrics | null {
  const client = useApixClient();
  const [metrics, setMetrics] = useState<ApixMetrics | null>(client.getMetrics());

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(client.getMetrics());
    };

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, [client]);

  return metrics;
}

/**
 * Hook to get connection information
 */
export function useApixConnectionInfo() {
  const client = useApixClient();
  const [connectionInfo, setConnectionInfo] = useState(client.getConnectionInfo());

  useEffect(() => {
    const updateInfo = () => {
      setConnectionInfo(client.getConnectionInfo());
    };

    // Update info every 2 seconds
    const interval = setInterval(updateInfo, 2000);

    return () => clearInterval(interval);
  }, [client]);

  return connectionInfo;
}

/**
 * Hook to handle streaming responses
 */
export function useApixStream(streamId: string | null) {
  const [chunks, setChunks] = useState<ApixEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [combinedData, setCombinedData] = useState<any>(null);

  const streamEvents = useStreamingEvents(streamId || undefined);

  useEffect(() => {
    if (!streamId) {
      setChunks([]);
      setIsComplete(false);
      setCombinedData(null);
      return;
    }

    const streamChunks = streamEvents.filter(event => 
      event.streamId === streamId && 
      (event.type === 'STREAM_CHUNK' || event.type === 'STREAM_DATA')
    );

    setChunks(streamChunks);

    // Check if stream is complete
    const hasEndChunk = streamChunks.some(chunk => chunk.isStreamEnd);
    const hasAllChunks = streamChunks.length > 0 && 
      streamChunks.every(chunk => chunk.totalChunks !== undefined) &&
      streamChunks.length === streamChunks[0]?.totalChunks;

    if (hasEndChunk || hasAllChunks) {
      setIsComplete(true);
      
      // Combine data from all chunks
      const sortedChunks = streamChunks.sort((a, b) => 
        (a.chunkIndex || 0) - (b.chunkIndex || 0)
      );
      
      const combined = sortedChunks.map(chunk => chunk.data);
      setCombinedData(combined);
    }
  }, [streamEvents, streamId]);

  return {
    chunks,
    isComplete,
    combinedData,
    progress: chunks.length > 0 && chunks[0]?.totalChunks 
      ? chunks.length / chunks[0].totalChunks 
      : 0
  };
}

/**
 * Hook to broadcast events to rooms
 */
export function useApixBroadcast() {
  const client = useApixClient();

  const broadcast = useCallback(async (
    channel: ApixChannel,
    data: any,
    roomId?: string
  ) => {
    if (!client.isConnectedToServer()) {
      throw new Error('Not connected to APIX server');
    }

    const event = {
      type: 'BROADCAST' as ApixEventType,
      channel,
      data,
      metadata: {
        timestamp: new Date(),
        source: 'react-hook'
      }
    };

    return client.publish(event);
  }, [client]);

  return broadcast;
}

/**
 * Hook for real-time collaboration features
 */
export function useApixCollaboration(roomId: string) {
  const { isInRoom } = useApixRoom(roomId);
  const broadcast = useApixBroadcast();
  
  const [participants, setParticipants] = useState<string[]>([]);
  const [cursors, setCursors] = useState<Record<string, any>>({});

  // Subscribe to collaboration events
  const collaborationEvents = useApixEvents({
    channel: APIX_CHANNELS.USER_EVENTS,
    filters: { roomId }
  });

  useEffect(() => {
    // Process collaboration events
    for (const event of collaborationEvents) {
      switch (event.type) {
        case 'USER_CONNECTED':
          if (event.metadata.userId) {
            setParticipants(prev => [...new Set([...prev, event.metadata.userId!])]);
          }
          break;
        case 'USER_DISCONNECTED':
          if (event.metadata.userId) {
            setParticipants(prev => prev.filter(id => id !== event.metadata.userId));
            setCursors(prev => {
              const newCursors = { ...prev };
              delete newCursors[event.metadata.userId!];
              return newCursors;
            });
          }
          break;
        case 'USER_ACTION':
          if (event.data.type === 'cursor_move' && event.metadata.userId) {
            setCursors(prev => ({
              ...prev,
              [event.metadata.userId!]: event.data.cursor
            }));
          }
          break;
      }
    }
  }, [collaborationEvents]);

  const sendCursorUpdate = useCallback((cursor: any) => {
    if (isInRoom) {
      broadcast(APIX_CHANNELS.USER_EVENTS, {
        type: 'cursor_move',
        cursor
      });
    }
  }, [isInRoom, broadcast]);

  const sendUserAction = useCallback((action: any) => {
    if (isInRoom) {
      broadcast(APIX_CHANNELS.USER_EVENTS, {
        type: 'user_action',
        action
      });
    }
  }, [isInRoom, broadcast]);

  return {
    isInRoom,
    participants,
    cursors,
    sendCursorUpdate,
    sendUserAction
  };
}