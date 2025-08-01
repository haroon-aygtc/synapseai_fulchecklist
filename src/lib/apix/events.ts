/**
 * APIX Protocol - Event Utilities
 * 
 * This file provides utility functions for creating and handling APIX events.
 */

import { v4 as uuidv4 } from 'uuid';
import { apixClient } from './client';
import {
  ApixEvent,
  ErrorOccurredEvent,
  FallbackTriggeredEvent,
  RequestUserInputEvent,
  SessionEndEvent,
  SessionStartEvent,
  StateUpdateEvent,
  TextChunkEvent,
  ThinkingStatusEvent,
  ToolCallErrorEvent,
  ToolCallResultEvent,
  ToolCallStartEvent
} from './types';

/**
 * Create and publish a tool call start event
 */
export function publishToolCallStart(data: {
  toolId: string;
  toolName: string;
  parameters: Record<string, any>;
  agentId?: string;
  workflowId?: string;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<ToolCallStartEvent> = {
    type: 'tool_call_start',
    channel: 'tool-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      toolId: data.toolId,
      toolName: data.toolName,
      parameters: data.parameters,
      agentId: data.agentId,
      workflowId: data.workflowId
    }
  };

  return apixClient.publish<ToolCallStartEvent>(event);
}

/**
 * Create and publish a tool call result event
 */
export function publishToolCallResult(data: {
  toolId: string;
  toolName: string;
  result: any;
  executionTime: number;
  agentId?: string;
  workflowId?: string;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<ToolCallResultEvent> = {
    type: 'tool_call_result',
    channel: 'tool-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      toolId: data.toolId,
      toolName: data.toolName,
      result: data.result,
      executionTime: data.executionTime,
      agentId: data.agentId,
      workflowId: data.workflowId
    }
  };

  return apixClient.publish<ToolCallResultEvent>(event);
}

/**
 * Create and publish a tool call error event
 */
export function publishToolCallError(data: {
  toolId: string;
  toolName: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  agentId?: string;
  workflowId?: string;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<ToolCallErrorEvent> = {
    type: 'tool_call_error',
    channel: 'tool-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      toolId: data.toolId,
      toolName: data.toolName,
      error: data.error,
      agentId: data.agentId,
      workflowId: data.workflowId
    }
  };

  return apixClient.publish<ToolCallErrorEvent>(event);
}

/**
 * Create and publish a thinking status event
 */
export function publishThinkingStatus(data: {
  agentId: string;
  status: 'started' | 'processing' | 'completed';
  message?: string;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<ThinkingStatusEvent> = {
    type: 'thinking_status',
    channel: 'agent-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      agentId: data.agentId,
      status: data.status,
      message: data.message
    }
  };

  return apixClient.publish<ThinkingStatusEvent>(event);
}

/**
 * Create and publish a text chunk event
 */
export function publishTextChunk(data: {
  agentId: string;
  text: string;
  isComplete: boolean;
  metadata?: Record<string, any>;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<TextChunkEvent> = {
    type: 'text_chunk',
    channel: 'agent-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      agentId: data.agentId,
      text: data.text,
      isComplete: data.isComplete,
      metadata: data.metadata
    }
  };

  return apixClient.publish<TextChunkEvent>(event);
}

/**
 * Create and publish a request user input event
 */
export function publishRequestUserInput(data: {
  agentId: string;
  prompt?: string;
  inputType: 'text' | 'choice' | 'file' | 'confirmation';
  choices?: Array<{
    id: string;
    label: string;
    value: any;
  }>;
  metadata?: Record<string, any>;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<RequestUserInputEvent> = {
    type: 'request_user_input',
    channel: 'agent-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      agentId: data.agentId,
      prompt: data.prompt,
      inputType: data.inputType,
      choices: data.choices,
      metadata: data.metadata
    }
  };

  return apixClient.publish<RequestUserInputEvent>(event);
}

/**
 * Create and publish a state update event
 */
export function publishStateUpdate(data: {
  workflowId: string;
  nodeId?: string;
  state: Record<string, any>;
  previousState?: Record<string, any>;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<StateUpdateEvent> = {
    type: 'state_update',
    channel: 'workflow-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      workflowId: data.workflowId,
      nodeId: data.nodeId,
      state: data.state,
      previousState: data.previousState
    }
  };

  return apixClient.publish<StateUpdateEvent>(event);
}

/**
 * Create and publish a session start event
 */
export function publishSessionStart(data: {
  sessionType: 'agent' | 'workflow' | 'tool' | 'user';
  metadata: Record<string, any>;
  organizationId?: string;
  sessionId?: string;
}): string {
  // Generate a session ID if not provided
  const sessionId = data.sessionId || uuidv4();

  const event: Partial<SessionStartEvent> = {
    type: 'session_start',
    channel: 'system-events',
    organizationId: data.organizationId,
    sessionId,
    data: {
      sessionType: data.sessionType,
      metadata: data.metadata
    }
  };

  return apixClient.publish<SessionStartEvent>(event);
}

/**
 * Create and publish a session end event
 */
export function publishSessionEnd(data: {
  sessionType: 'agent' | 'workflow' | 'tool' | 'user';
  duration: number;
  metadata: Record<string, any>;
  organizationId?: string;
  sessionId: string;
}): string {
  const event: Partial<SessionEndEvent> = {
    type: 'session_end',
    channel: 'system-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      sessionType: data.sessionType,
      duration: data.duration,
      metadata: data.metadata
    }
  };

  return apixClient.publish<SessionEndEvent>(event);
}

/**
 * Create and publish an error occurred event
 */
export function publishErrorOccurred(data: {
  source: string;
  message: string;
  code?: string;
  stack?: string;
  metadata?: Record<string, any>;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<ErrorOccurredEvent> = {
    type: 'error_occurred',
    channel: 'system-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      source: data.source,
      message: data.message,
      code: data.code,
      stack: data.stack,
      metadata: data.metadata
    }
  };

  return apixClient.publish<ErrorOccurredEvent>(event);
}

/**
 * Create and publish a fallback triggered event
 */
export function publishFallbackTriggered(data: {
  primaryProvider: string;
  fallbackProvider: string;
  reason: string;
  latency?: number;
  metadata?: Record<string, any>;
  organizationId?: string;
  sessionId?: string;
}): string {
  const event: Partial<FallbackTriggeredEvent> = {
    type: 'fallback_triggered',
    channel: 'provider-events',
    organizationId: data.organizationId,
    sessionId: data.sessionId,
    data: {
      primaryProvider: data.primaryProvider,
      fallbackProvider: data.fallbackProvider,
      reason: data.reason,
      latency: data.latency,
      metadata: data.metadata
    }
  };

  return apixClient.publish<FallbackTriggeredEvent>(event);
}

/**
 * Helper to extract data from an event
 */
export function getEventData<T extends ApixEvent>(event: T): T['data'] {
  return event.data;
}

/**
 * Helper to check if an event is of a specific type
 */
export function isEventType<T extends ApixEvent>(
  event: ApixEvent,
  type: T['type']
): event is T {
  return event.type === type;
}