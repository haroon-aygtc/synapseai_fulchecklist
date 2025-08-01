/**
 * APIX Protocol - Context Provider
 * 
 * This file provides a React context provider for the APIX client.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apixClient, ApixClient } from './client';
import { ConnectionOptions, ConnectionStatus } from './types';

// Context type
interface ApixContextType {
  client: ApixClient;
  status: ConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
}

// Create context
const ApixContext = createContext<ApixContextType | null>(null);

// Provider props
interface ApixProviderProps {
  children: React.ReactNode;
  options?: ConnectionOptions;
  autoConnect?: boolean;
}

/**
 * APIX Provider Component
 * 
 * Provides the APIX client to all child components and manages connection lifecycle.
 */
export function ApixProvider({
  children,
  options,
  autoConnect = true
}: ApixProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>(apixClient.getStatus());

  // Apply options if provided
  useEffect(() => {
    if (options) {
      // In a real implementation, we would apply these options to the client
      // For now, we'll just log them
      console.log('APIX options:', options);
    }
  }, [options]);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = apixClient.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && status === 'disconnected') {
      apixClient.connect().catch(console.error);
    }

    return () => {
      // Don't disconnect on unmount, as other components may be using the connection
    };
  }, [autoConnect, status]);

  // Connect function
  const connect = async () => {
    await apixClient.connect();
  };

  // Disconnect function
  const disconnect = () => {
    apixClient.disconnect();
  };

  // Context value
  const contextValue: ApixContextType = {
    client: apixClient,
    status,
    connect,
    disconnect,
    isConnected: status === 'connected'
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