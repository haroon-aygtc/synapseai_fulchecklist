/**
 * APIX Protocol - Main Export
 * 
 * This file exports all APIX functionality for easy importing.
 */

// Export types
export * from './types';

// Export client
export { ApixClient, apixClient } from './client';

// Export context
export { ApixProvider, useApixContext } from './context';

// Export hooks
export {
  useApixClient,
  useApixConnection,
  useApixEvents,
  useApixPublish,
  useApixRoom,
  useApixStatus,
  useApixSubscriptionOptions,
  useLatestApixEvent
} from './hooks';

// Export event utilities
export * from './events';