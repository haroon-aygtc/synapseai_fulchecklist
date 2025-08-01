/**
 * APIX Protocol - React Hooks
 * 
 * This file provides React hooks for using the APIX client in components.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apixClient, ApixClient } from './client';
import {
  ApixEvent,
  ConnectionStatus,
  EventHandler,
  SubscriptionOptions
} from './types';

/**
 * Hook to access the APIX client instance
 */
export function useApixClient(): ApixClient {
  return apixClient;
}

/**
 * Hook to subscribe to APIX events
 */
export function useApixEvents<T extends ApixEvent>(
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
      setEvents(prev => [...prev, event]);
    };

    const unsubscribe = client.subscribe<T>(handler, options);

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
export function useLatestApixEvent<T extends ApixEvent>(
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
export function useApixConnection(autoConnect = true) {
  const client = useApixClient();
  const status = useApixStatus();

  const connect = useCallback(async () => {
    try {
      await client.connect();
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
      connect();
    }

    return () => {
      // Don't disconnect on unmount, as other components may be using the connection
    };
  }, [autoConnect, connect, status]);

  return {
    status,
    connect,
    disconnect,
    isConnected: status === 'connected'
  };
}

/**
 * Hook to join and leave APIX rooms
 */
export function useApixRoom(roomId: string | null) {
  const client = useApixClient();
  const { isConnected } = useApixConnection(true);

  useEffect(() => {
    if (!roomId || !isConnected) return;

    // Join room
    client.joinRoom(roomId);

    // Leave room on cleanup
    return () => {
      client.leaveRoom(roomId);
    };
  }, [client, roomId, isConnected]);

  return {
    isConnected,
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