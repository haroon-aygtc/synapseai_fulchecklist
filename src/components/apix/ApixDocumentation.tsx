'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { APIX_CHANNELS } from '@/lib/apix/types';
import { 
  Book, 
  Code, 
  Copy, 
  FileText, 
  Info, 
  MessageSquare, 
  Search,
  Server,
  Zap
} from 'lucide-react';

interface CodeSnippetProps {
  code: string;
  language?: string;
  title?: string;
}

function CodeSnippet({ code, language = 'typescript', title }: CodeSnippetProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="relative rounded-md bg-slate-950 text-slate-50 my-4">
      {title && (
        <div className="px-4 py-2 border-b border-slate-800 text-sm font-medium text-slate-400">
          {title}
        </div>
      )}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          className="absolute right-2 top-2 h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
          onClick={copyToClipboard}
        >
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copy code</span>
        </Button>
        <pre className="overflow-x-auto p-4 text-sm">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

/**
 * ApixDocumentation Component
 * 
 * Interactive documentation for the APIX protocol that displays available channels,
 * event types, and usage examples to help developers integrate with the system.
 */
export default function ApixDocumentation() {
  const [searchQuery, setSearchQuery] = useState('');

  // Example event types for documentation
  const eventTypes = {
    'agent-events': [
      'AGENT_CREATED', 'AGENT_UPDATED', 'AGENT_DELETED',
      'AGENT_EXECUTION_STARTED', 'AGENT_EXECUTION_COMPLETED', 'AGENT_EXECUTION_FAILED',
      'AGENT_MESSAGE_RECEIVED', 'AGENT_MESSAGE_SENT'
    ],
    'tool-events': [
      'TOOL_CREATED', 'TOOL_UPDATED', 'TOOL_DELETED',
      'TOOL_EXECUTION_STARTED', 'TOOL_EXECUTION_COMPLETED', 'TOOL_EXECUTION_FAILED'
    ],
    'workflow-events': [
      'WORKFLOW_CREATED', 'WORKFLOW_UPDATED', 'WORKFLOW_DELETED',
      'WORKFLOW_EXECUTION_STARTED', 'WORKFLOW_EXECUTION_COMPLETED', 'WORKFLOW_EXECUTION_FAILED',
      'WORKFLOW_NODE_STARTED', 'WORKFLOW_NODE_COMPLETED', 'WORKFLOW_NODE_FAILED'
    ],
    'provider-events': [
      'PROVIDER_CONNECTED', 'PROVIDER_DISCONNECTED', 'PROVIDER_ERROR',
      'PROVIDER_RATE_LIMIT', 'PROVIDER_FALLBACK_TRIGGERED'
    ],
    'system-events': [
      'SYSTEM_STARTUP', 'SYSTEM_SHUTDOWN', 'SYSTEM_ERROR',
      'SYSTEM_WARNING', 'SYSTEM_INFO'
    ],
    'user-events': [
      'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
      'USER_LOGIN', 'USER_LOGOUT', 'USER_PASSWORD_RESET'
    ],
    'organization-events': [
      'ORGANIZATION_CREATED', 'ORGANIZATION_UPDATED', 'ORGANIZATION_DELETED',
      'ORGANIZATION_MEMBER_ADDED', 'ORGANIZATION_MEMBER_REMOVED'
    ],
    'streaming': [
      'STREAM_STARTED', 'STREAM_CHUNK', 'STREAM_ENDED',
      'STREAM_ERROR'
    ],
    'custom': [
      'CUSTOM_EVENT'
    ]
  };

  // Filter event types based on search query
  const filteredEventTypes = Object.entries(eventTypes).reduce((acc, [channel, types]) => {
    if (!searchQuery) {
      acc[channel] = types;
      return acc;
    }
    
    const filteredTypes = types.filter(type => 
      type.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (filteredTypes.length > 0) {
      acc[channel] = filteredTypes;
    }
    
    return acc;
  }, {} as Record<string, string[]>);

  // Usage examples
  const usageExamples = {
    subscribe: `// Subscribe to events from a specific channel
import { useApixEvents, APIX_CHANNELS } from '@/lib/apix';

function MyComponent() {
  const agentEvents = useApixEvents({ 
    channel: APIX_CHANNELS.AGENT_EVENTS,
    includeHistory: true,
    historyLimit: 50
  });

  // Process events
  useEffect(() => {
    if (agentEvents.length > 0) {
      const latestEvent = agentEvents[agentEvents.length - 1];
      console.log('New agent event:', latestEvent);
    }
  }, [agentEvents]);

  return (
    <div>
      {agentEvents.map(event => (
        <div key={event.id}>{event.type}</div>
      ))}
    </div>
  );
}`,
    publish: `// Publish an event to a specific channel
import { useApixPublish, APIX_CHANNELS } from '@/lib/apix';

function EventPublisher() {
  const publish = useApixPublish();
  
  const sendEvent = () => {
    publish({
      type: 'CUSTOM_EVENT',
      channel: APIX_CHANNELS.CUSTOM,
      data: { message: 'Hello APIX!' },
      priority: 'normal',
      metadata: {
        userId: 'user-123',
        source: 'event-publisher-component'
      }
    });
  };

  return (
    <button onClick={sendEvent}>
      Send Event
    </button>
  );
}`,
    connection: `// Manage APIX connection
import { useApixContext } from '@/lib/apix';

function ConnectionManager() {
  const { 
    status, 
    isConnected, 
    connect, 
    disconnect,
    latency
  } = useApixContext();

  return (
    <div>
      <div>Status: {status}</div>
      <div>Latency: {latency}ms</div>
      
      {isConnected ? (
        <button onClick={disconnect}>
          Disconnect
        </button>
      ) : (
        <button onClick={() => connect('auth-token')}>
          Connect
        </button>
      )}
    </div>
  );
}`
  };

  return (
    <div className="bg-white dark:bg-slate-950">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            APIX Protocol Documentation
          </CardTitle>
          <CardDescription>
            Comprehensive guide to using the APIX real-time communication protocol
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search event types..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Tabs defaultValue="channels" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="channels" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Channels
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Event Types
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Usage Examples
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                API Reference
              </TabsTrigger>
            </TabsList>

            {/* Channels Tab */}
            <TabsContent value="channels" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(APIX_CHANNELS).map((channel) => (
                  <Card key={channel} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        {channel.split('-').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </CardTitle>
                      <CardDescription>
                        {getChannelDescription(channel)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span>Event Types:</span>
                        <Badge variant="secondary">
                          {eventTypes[channel as keyof typeof eventTypes]?.length || 0}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Event Types Tab */}
            <TabsContent value="events" className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                {Object.entries(filteredEventTypes).map(([channel, types]) => (
                  <AccordionItem key={channel} value={channel}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {channel.split('-').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </Badge>
                        <span className="text-sm text-slate-500">
                          {types.length} event types
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-64">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
                          {types.map((type) => (
                            <div 
                              key={type} 
                              className="p-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                              <div className="font-mono text-sm">{type}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {getEventTypeDescription(type)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              
              {Object.keys(filteredEventTypes).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No event types match your search query
                </div>
              )}
            </TabsContent>

            {/* Usage Examples Tab */}
            <TabsContent value="usage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Subscribing to Events</CardTitle>
                  <CardDescription>
                    How to subscribe to and process events from APIX channels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeSnippet 
                    code={usageExamples.subscribe} 
                    title="useApixEvents Hook Example" 
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Publishing Events</CardTitle>
                  <CardDescription>
                    How to publish events to APIX channels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeSnippet 
                    code={usageExamples.publish} 
                    title="useApixPublish Hook Example" 
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Managing Connections</CardTitle>
                  <CardDescription>
                    How to manage APIX connections and monitor status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeSnippet 
                    code={usageExamples.connection} 
                    title="useApixContext Hook Example" 
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* API Reference Tab */}
            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">APIX Client API</CardTitle>
                  <CardDescription>
                    Core client methods and properties
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">connect(token?: string, organizationId?: string): Promise&lt;void&gt;</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Establishes a connection to the APIX server with optional authentication.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">disconnect(): void</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Closes the current connection to the APIX server.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">subscribe(channel: ApixChannel, options?: SubscriptionOptions): () => void</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Subscribes to events from a specific channel and returns an unsubscribe function.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">publish(event: ApixEvent): Promise&lt;void&gt;</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Publishes an event to the specified channel.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">getStatus(): ConnectionStatus</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Returns the current connection status.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">onStatusChange(callback: (status: ConnectionStatus) => void): () => void</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Registers a callback for connection status changes and returns an unsubscribe function.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">getMetrics(): ApixMetrics</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Returns performance metrics for the APIX connection.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">React Hooks</CardTitle>
                  <CardDescription>
                    React hooks for integrating APIX in your components
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">useApixContext(): ApixContextType</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Provides access to the APIX client and connection state.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">useApixEvents(options: EventOptions): ApixEvent[]</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Subscribes to events from specified channels and returns an array of events.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">useApixPublish(): (event: ApixEvent) => Promise&lt;void&gt;</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Returns a function for publishing events to APIX channels.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">useApixConnectionInfo(): ConnectionInfo</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Provides detailed information about the current connection.
                      </div>
                    </div>
                    
                    <div className="border-b pb-2">
                      <div className="font-mono text-sm">useApixMetrics(): ApixMetrics | null</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Provides real-time performance metrics for the APIX system.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions for descriptions
function getChannelDescription(channel: string): string {
  const descriptions: Record<string, string> = {
    'agent-events': 'Events related to agent lifecycle and operations',
    'tool-events': 'Events related to tool execution and management',
    'workflow-events': 'Events related to workflow execution and state changes',
    'provider-events': 'Events related to AI provider connections and operations',
    'system-events': 'System-level events and notifications',
    'user-events': 'User activity and account-related events',
    'organization-events': 'Organization management and member events',
    'streaming': 'Events for real-time streaming data',
    'custom': 'Custom application-specific events'
  };
  
  return descriptions[channel] || 'Channel for APIX events';
}

function getEventTypeDescription(eventType: string): string {
  const descriptions: Record<string, string> = {
    'AGENT_CREATED': 'A new agent has been created',
    'AGENT_UPDATED': 'An agent has been updated',
    'AGENT_DELETED': 'An agent has been deleted',
    'AGENT_EXECUTION_STARTED': 'Agent execution has started',
    'AGENT_EXECUTION_COMPLETED': 'Agent execution has completed successfully',
    'AGENT_EXECUTION_FAILED': 'Agent execution has failed',
    'AGENT_MESSAGE_RECEIVED': 'Agent has received a message',
    'AGENT_MESSAGE_SENT': 'Agent has sent a message',
    
    'TOOL_CREATED': 'A new tool has been created',
    'TOOL_UPDATED': 'A tool has been updated',
    'TOOL_DELETED': 'A tool has been deleted',
    'TOOL_EXECUTION_STARTED': 'Tool execution has started',
    'TOOL_EXECUTION_COMPLETED': 'Tool execution has completed successfully',
    'TOOL_EXECUTION_FAILED': 'Tool execution has failed',
    
    'WORKFLOW_CREATED': 'A new workflow has been created',
    'WORKFLOW_UPDATED': 'A workflow has been updated',
    'WORKFLOW_DELETED': 'A workflow has been deleted',
    'WORKFLOW_EXECUTION_STARTED': 'Workflow execution has started',
    'WORKFLOW_EXECUTION_COMPLETED': 'Workflow execution has completed successfully',
    'WORKFLOW_EXECUTION_FAILED': 'Workflow execution has failed',
    'WORKFLOW_NODE_STARTED': 'A workflow node has started execution',
    'WORKFLOW_NODE_COMPLETED': 'A workflow node has completed execution',
    'WORKFLOW_NODE_FAILED': 'A workflow node has failed execution',
    
    'PROVIDER_CONNECTED': 'Connection to an AI provider has been established',
    'PROVIDER_DISCONNECTED': 'Connection to an AI provider has been lost',
    'PROVIDER_ERROR': 'An error occurred with an AI provider',
    'PROVIDER_RATE_LIMIT': 'Rate limit reached for an AI provider',
    'PROVIDER_FALLBACK_TRIGGERED': 'Fallback to another provider has been triggered',
    
    'SYSTEM_STARTUP': 'System has started up',
    'SYSTEM_SHUTDOWN': 'System is shutting down',
    'SYSTEM_ERROR': 'A system error has occurred',
    'SYSTEM_WARNING': 'A system warning has been issued',
    'SYSTEM_INFO': 'System information event',
    
    'USER_CREATED': 'A new user has been created',
    'USER_UPDATED': 'A user has been updated',
    'USER_DELETED': 'A user has been deleted',
    'USER_LOGIN': 'A user has logged in',
    'USER_LOGOUT': 'A user has logged out',
    'USER_PASSWORD_RESET': 'A user has reset their password',
    
    'ORGANIZATION_CREATED': 'A new organization has been created',
    'ORGANIZATION_UPDATED': 'An organization has been updated',
    'ORGANIZATION_DELETED': 'An organization has been deleted',
    'ORGANIZATION_MEMBER_ADDED': 'A member has been added to an organization',
    'ORGANIZATION_MEMBER_REMOVED': 'A member has been removed from an organization',
    
    'STREAM_STARTED': 'A new stream has started',
    'STREAM_CHUNK': 'A chunk of streaming data has been received',
    'STREAM_ENDED': 'A stream has ended',
    'STREAM_ERROR': 'An error occurred in a stream',
    
    'CUSTOM_EVENT': 'A custom application-specific event'
  };
  
  return descriptions[eventType] || 'APIX event';
}