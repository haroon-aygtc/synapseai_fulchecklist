/**
 * APIX Protocol - Context Provider
 * 
 * This file provides a React context provider for the APIX client.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apixClient, ApixClient } from './client';
import { ConnectionOptions, ConnectionStatus, ApixMetrics, ApixEvent, ApixChannel } from './types';

// Context type
interface ApixContextType {
  client: ApixClient;
  status: ConnectionStatus;
  connect: (token?: string, organizationId?: string) => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
  metrics: ApixMetrics | null;
  connectionInfo: any;
  latency: number;
}

// Create context
const ApixContext = createContext<ApixContextType | null>(null);

// Provider props
interface ApixProviderProps {
  children: React.ReactNode;
  options?: ConnectionOptions;
  autoConnect?: boolean;
  token?: string;
  organizationId?: string;
}

/**
 * APIX Provider Component
 * 
 * Provides the APIX client to all child components and manages connection lifecycle.
 */
export function ApixProvider({
  children,
  options,
  autoConnect = false,
  token,
  organizationId
}: ApixProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>(apixClient.getStatus());
  const [metrics, setMetrics] = useState<ApixMetrics | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<any>({});
  const [latency, setLatency] = useState<number>(0);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = apixClient.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  // Update connection info and metrics periodically
  useEffect(() => {
    const updateInfo = () => {
      setConnectionInfo(apixClient.getConnectionInfo());
      setMetrics(apixClient.getMetrics());
      setLatency(apixClient.getLatencyScore());
    };

    updateInfo(); // Initial update
    const interval = setInterval(updateInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [status]);

  // Auto-connect if enabled and credentials are provided
  useEffect(() => {
    if (autoConnect && status === 'disconnected' && token) {
      apixClient.connect(token, organizationId).catch(console.error);
    }
  }, [autoConnect, status, token, organizationId]);

  // Connect function
  const connect = useCallback(async (authToken?: string, orgId?: string) => {
    const finalToken = authToken || token;
    const finalOrgId = orgId || organizationId;
    
    if (!finalToken) {
      throw new Error('Authentication token is required');
    }
    
    await apixClient.connect(finalToken, finalOrgId);
  }, [token, organizationId]);

  // Disconnect function
  const disconnect = useCallback(() => {
    apixClient.disconnect();
  }, []);

  // Context value
  const contextValue: ApixContextType = {
    client: apixClient,
    status,
    connect,
    disconnect,
    isConnected: status === 'connected',
    metrics,
    connectionInfo,
    latency
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
 * Higher-order component to provide APIX context
 */
export function withApix<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    autoConnect?: boolean;
    token?: string;
    organizationId?: string;
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