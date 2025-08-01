import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SDKEventSystem, initializeGlobalEventSystem, getGlobalEventSystem } from '../events/event-system';

interface EventContextValue {
  eventSystem: SDKEventSystem | null;
  isInitialized: boolean;
  isConnected: boolean;
  connectionStatus: string;
  error: string | null;
}

const EventContext = createContext<EventContextValue>({
  eventSystem: null,
  isInitialized: false,
  isConnected: false,
  connectionStatus: 'disconnected',
  error: null
});

export interface EventProviderProps {
  children: ReactNode;
  config: {
    apiUrl: string;
    apiKey: string;
    tenantId: string;
    componentId?: string;
    enableBatching?: boolean;
    batchSize?: number;
    batchTimeout?: number;
    enableRetry?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  };
  autoConnect?: boolean;
}

export function EventProvider({ children, config, autoConnect = true }: EventProviderProps) {
  const [eventSystem, setEventSystem] = useState<SDKEventSystem | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let system: SDKEventSystem | null = null;

    const initializeSystem = async () => {
      try {
        setError(null);
        
        // Check if global system already exists
        const existingSystem = getGlobalEventSystem();
        if (existingSystem) {
          system = existingSystem;
        } else {
          system = initializeGlobalEventSystem(config);
        }

        setEventSystem(system);

        if (autoConnect) {
          await system.initialize();
          setIsInitialized(true);
          setIsConnected(system.isConnected());
          setConnectionStatus(system.getConnectionStatus());

          // Subscribe to connection status changes
          system.subscribe('SDK_CONNECTION_STATUS_CHANGE', (event) => {
            setConnectionStatus(event.data.status);
            setIsConnected(event.data.status === 'connected');
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize event system');
        setIsInitialized(false);
        setIsConnected(false);
      }
    };

    initializeSystem();

    return () => {
      // Don't destroy the global system on unmount, just clean up local state
      setEventSystem(null);
      setIsInitialized(false);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setError(null);
    };
  }, [config, autoConnect]);

  const contextValue: EventContextValue = {
    eventSystem,
    isInitialized,
    isConnected,
    connectionStatus,
    error
  };

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within an EventProvider');
  }
  return context;
}

export function useEventSystemFromContext(): SDKEventSystem {
  const { eventSystem } = useEventContext();
  if (!eventSystem) {
    throw new Error('Event system not initialized. Make sure EventProvider is properly configured.');
  }
  return eventSystem;
}