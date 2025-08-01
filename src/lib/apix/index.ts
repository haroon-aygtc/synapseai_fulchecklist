/**
 * APIX Protocol - Main Export File
 * 
 * This file exports all APIX functionality for easy importing.
 */

// Re-export commonly used items for convenience
export { apixClient } from './client';
export { ApixProvider, useApixContext } from './context';
export { 
  useApixClient,
  useApixEvents,
  useLatestApixEvent,
  useApixPublish,
  useApixStatus,
  useApixConnection,
  useApixRoom,
  useAgentEvents,
  useToolEvents,
  useWorkflowEvents,
  useSystemEvents,
  useStreamingEvents,
  useApixMetrics,
  useApixConnectionInfo,
  useApixStream,
  useApixBroadcast,
  useApixCollaboration
} from './hooks';

// Export event utilities
export * from './events';