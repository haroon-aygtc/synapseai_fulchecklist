/**
 * Enhanced APIX Provider with full WebSocket functionality
 * 
 * This component provides comprehensive APIX connection management with
 * authentication, channel subscriptions, and real-time event streaming.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { apixClient, ApixClient } from './client';
import { 
  ConnectionOptions, 
  ConnectionStatus, 
  ApixMetrics, 
  ApixEvent, 
  ApixChannel,
  APIX_CHANNELS,
  EventHandler,
  SubscriptionOptions
} from './types';

// Enhanced context type with full functionality
interface ApixContextType {
  client: ApixClient;
  status: ConnectionStatus;
  connect: (token?: string, organizationId?: string) => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  metrics: ApixMetrics | null;
  connectionInfo: any;
  latency: number;
  subscribe: <T extends ApixEvent>(
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ) => () => void;
  publish: <T extends ApixEvent>(
    event: Partial<T> & { type: T['type']; channel: T['channel'] }
  ) => string;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  getEventHistory: (channel?: ApixChannel, limit?: number) => ApixEvent[];
  clearEventHistory: () => void;
  connectionHistory: Array<{
    timestamp: Date;
    event: string;
    details?: string;
  }>;
}

// Create context
const ApixContext = createContext<ApixContextType | null>(null);

// Enhanced provider props
interface ApixProviderProps {
  children: React.ReactNode;
  options?: ConnectionOptions;
  autoConnect?: boolean;
  token?: string;
  organizationId?: string;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
  onEvent?: (event: ApixEvent) => void;
  enableEventHistory?: boolean;
  maxEventHistory?: number;
  enableMetrics?: boolean;
  metricsInterval?: number;
}

/**
 * Enhanced APIX Provider Component
 * 
 * Provides comprehensive APIX functionality including connection management,
 * event streaming, room management, and real-time metrics.
 */
export function ApixProvider({
  children,
  options,
  autoConnect = false,
  token,
  organizationId,
  onConnectionChange,
  onError,
  onEvent,
  enableEventHistory = true,
  maxEventHistory = 1000,
  enableMetrics = true,
  metricsInterval = 5000
}: ApixProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>(apixClient.getStatus());
  const [metrics, setMetrics] = useState<ApixMetrics | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<any>({});
  const [latency, setLatency] = useState<number>(0);
  const [connectionHistory, setConnectionHistory] = useState<Array<{
    timestamp: Date;
    event: string;
    details?: string;
  }>>([]);
  
  const eventHistoryRef = useRef<ApixEvent[]>([]);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connection state helpers
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isReconnecting = status === 'reconnecting';

  // Add connection event to history
  const addConnectionEvent = useCallback((event: string, details?: string) => {
    setConnectionHistory(prev => [
      { timestamp: new Date(), event, details },
      ...prev.slice(0, 49) // Keep last 50 events
    ]);
  }, []);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = apixClient.onStatusChange((newStatus) => {
      setStatus(newStatus);
      addConnectionEvent(`Status changed to: ${newStatus}`);
      onConnectionChange?.(newStatus);
    });
    return unsubscribe;
  }, [addConnectionEvent, onConnectionChange]);

  // Update connection info and metrics periodically
  useEffect(() => {
    if (!enableMetrics) return;

    const updateInfo = () => {
      setConnectionInfo(apixClient.getConnectionInfo());
      setMetrics(apixClient.getMetrics());
      setLatency(apixClient.getLatencyScore());
    };

    updateInfo(); // Initial update
    
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
    }
    
    metricsIntervalRef.current = setInterval(updateInfo, metricsInterval);

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [status, enableMetrics, metricsInterval]);

  // Auto-connect if enabled and credentials are provided
  useEffect(() => {
    if (autoConnect && status === 'disconnected' && token) {
      connect(token, organizationId).catch((error) => {
        addConnectionEvent('Auto-connect failed', error.message);
        onError?.(error);
      });
    }
  }, [autoConnect, status, token, organizationId]);

  // Enhanced connect function with retry logic
  const connect = useCallback(async (authToken?: string, orgId?: string) => {
    const finalToken = authToken || token;
    const finalOrgId = orgId || organizationId;
    
    if (!finalToken) {
      const error = new Error('Authentication token is required');
      onError?.(error);
      throw error;
    }
    
    try {
      addConnectionEvent('Connection attempt started');
      await apixClient.connect(finalToken, finalOrgId);
      addConnectionEvent('Connection successful');
    } catch (error) {
      addConnectionEvent('Connection failed', error.message);
      onError?.(error);
      throw error;
    }
  }, [token, organizationId, addConnectionEvent, onError]);

  // Enhanced disconnect function
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Unsubscribe from all subscriptions
    subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
    subscriptionsRef.current.clear();

    apixClient.disconnect();
    addConnectionEvent('Manual disconnect');
  }, [addConnectionEvent]);

  // Reconnect function with exponential backoff
  const reconnect = useCallback(async () => {
    if (isConnected) {
      disconnect();
      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    try {
      await connect();
    } catch (error) {
      // Implement exponential backoff for reconnection
      const delay = Math.min(30000, Math.pow(2, connectionInfo.reconnectAttempts || 0) * 1000);
      
      addConnectionEvent(`Reconnect failed, retrying in ${delay}ms`, error.message);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnect();
      }, delay);
    }
  }, [isConnected, disconnect, connect, connectionInfo.reconnectAttempts, addConnectionEvent]);

  // Enhanced subscribe function with automatic cleanup
  const subscribe = useCallback(<T extends ApixEvent>(
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): (() => void) => {
    // Wrap handler to add to event history and call onEvent
    const wrappedHandler = (event: T) => {
      if (enableEventHistory) {
        eventHistoryRef.current.push(event);
        if (eventHistoryRef.current.length > maxEventHistory) {
          eventHistoryRef.current = eventHistoryRef.current.slice(-maxEventHistory);
        }
      }
      
      onEvent?.(event);
      handler(event);
    };

    const unsubscribe = apixClient.subscribe(wrappedHandler, options);
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    subscriptionsRef.current.set(subscriptionId, unsubscribe);

    // Return enhanced unsubscribe function
    return () => {
      unsubscribe();
      subscriptionsRef.current.delete(subscriptionId);
    };
  }, [enableEventHistory, maxEventHistory, onEvent]);

  // Enhanced publish function with validation
  const publish = useCallback(<T extends ApixEvent>(
    event: Partial<T> & { type: T['type']; channel: T['channel'] }
  ): string => {
    if (!isConnected) {
      addConnectionEvent('Publish failed', 'Not connected to server');
      throw new Error('Not connected to APIX server');
    }

    try {
      const eventId = apixClient.publish(event);
      addConnectionEvent(`Event published: ${event.type}`, `ID: ${eventId}`);
      return eventId;
    } catch (error) {
      addConnectionEvent('Publish failed', error.message);
      onError?.(error);
      throw error;
    }
  }, [isConnected, addConnectionEvent, onError]);

  // Room management functions
  const joinRoom = useCallback(async (roomId: string) => {
    if (!isConnected) {
      throw new Error('Not connected to APIX server');
    }

    try {
      await apixClient.joinRoom(roomId);
      addConnectionEvent(`Joined room: ${roomId}`);
    } catch (error) {
      addConnectionEvent(`Failed to join room: ${roomId}`, error.message);
      onError?.(error);
      throw error;
    }
  }, [isConnected, addConnectionEvent, onError]);

  const leaveRoom = useCallback(async (roomId: string) => {
    if (!isConnected) {
      throw new Error('Not connected to APIX server');
    }

    try {
      await apixClient.leaveRoom(roomId);
      addConnectionEvent(`Left room: ${roomId}`);
    } catch (error) {
      addConnectionEvent(`Failed to leave room: ${roomId}`, error.message);
      onError?.(error);
      throw error;
    }
  }, [isConnected, addConnectionEvent, onError]);

  // Event history management
  const getEventHistory = useCallback((channel?: ApixChannel, limit: number = 100): ApixEvent[] => {
    let events = [...eventHistoryRef.current];
    
    if (channel) {
      events = events.filter(event => event.channel === channel);
    }
    
    return events.slice(-limit);
  }, []);

  const clearEventHistory = useCallback(() => {
    eventHistoryRef.current = [];
    addConnectionEvent('Event history cleared');
  }, [addConnectionEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Clean up all subscriptions
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, []);

  // Context value
  const contextValue: ApixContextType = {
    client: apixClient,
    status,
    connect,
    disconnect,
    reconnect,
    isConnected,
    isConnecting,
    isReconnecting,
    metrics,
    connectionInfo,
    latency,
    subscribe,
    publish,
    joinRoom,
    leaveRoom,
    getEventHistory,
    clearEventHistory,
    connectionHistory
  };

  return (
    <ApixContext.Provider value={contextValue}>
      {children}
    </ApixContext.Provider>
  );
}

/**
 * Hook to use the APIX context
 */
export function useApixContext(): ApixContextType {
  const context = useContext(ApixContext);
  
  if (!context) {
    throw new Error('useApixContext must be used within an ApixProvider');
  }
  
  return context;
}

/**
 * Hook for subscribing to specific APIX events
 */
export function useApixSubscription<T extends ApixEvent>(
  handler: EventHandler<T>,
  options: SubscriptionOptions = {},
  deps: React.DependencyList = []
): void {
  const { subscribe } = useApixContext();

  useEffect(() => {
    const unsubscribe = subscribe(handler, options);
    return unsubscribe;
  }, [subscribe, ...deps]);
}

/**
 * Hook for publishing APIX events
 */
export function useApixPublish() {
  const { publish, isConnected } = useApixContext();
  
  return useCallback(<T extends ApixEvent>(
    event: Partial<T> & { type: T['type']; channel: T['channel'] }
  ) => {
    if (!isConnected) {
      throw new Error('Not connected to APIX server');
    }
    return publish(event);
  }, [publish, isConnected]);
}

/**
 * Hook for managing APIX rooms
 */
export function useApixRooms() {
  const { joinRoom, leaveRoom, isConnected } = useApixContext();
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set());

  const join = useCallback(async (roomId: string) => {
    if (!isConnected) {
      throw new Error('Not connected to APIX server');
    }
    
    await joinRoom(roomId);
    setJoinedRooms(prev => new Set([...prev, roomId]));
  }, [joinRoom, isConnected]);

  const leave = useCallback(async (roomId: string) => {
    if (!isConnected) {
      throw new Error('Not connected to APIX server');
    }
    
    await leaveRoom(roomId);
    setJoinedRooms(prev => {
      const newSet = new Set(prev);
      newSet.delete(roomId);
      return newSet;
    });
  }, [leaveRoom, isConnected]);

  const leaveAll = useCallback(async () => {
    const rooms = Array.from(joinedRooms);
    await Promise.all(rooms.map(roomId => leave(roomId)));
  }, [joinedRooms, leave]);

  return {
    joinedRooms: Array.from(joinedRooms),
    join,
    leave,
    leaveAll
  };
}

/**
 * Hook for APIX connection info and metrics
 */
export function useApixConnectionInfo() {
  const { connectionInfo } = useApixContext();
  return connectionInfo;
}

export function useApixMetrics() {
  const { metrics } = useApixContext();
  return metrics;
}

/**
 * Hook for APIX event history
 */
export function useApixEventHistory(channel?: ApixChannel, limit: number = 100) {
  const { getEventHistory, clearEventHistory } = useApixContext();
  const [events, setEvents] = useState<ApixEvent[]>([]);

  useEffect(() => {
    const updateEvents = () => {
      setEvents(getEventHistory(channel, limit));
    };

    updateEvents();
    const interval = setInterval(updateEvents, 1000);

    return () => clearInterval(interval);
  }, [getEventHistory, channel, limit]);

  return {
    events,
    clearHistory: clearEventHistory
  };
}

/**
 * Higher-order component to provide APIX context with enhanced options
 */
export function withApix<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    autoConnect?: boolean;
    token?: string;
    organizationId?: string;
    enableEventHistory?: boolean;
    enableMetrics?: boolean;
    onConnectionChange?: (status: ConnectionStatus) => void;
    onError?: (error: Error) => void;
  }
) {
  return function ApixWrappedComponent(props: P) {
    return (
      <ApixProvider {...options}>
        <Component {...props} />
      </ApixProvider>
    );
  };
}

// Export enhanced types
export type {
  ApixContextType,
  ApixProviderProps
};