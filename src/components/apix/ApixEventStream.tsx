/**
 * APIX Event Stream Component
 * 
 * This component displays a real-time stream of APIX events.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useApixEvents, 
  useApixConnection, 
  APIX_CHANNELS, 
  ApixEvent, 
  ApixChannel,
  ApixEventFilter 
} from '@/lib/apix';
import { Activity, Filter, Trash2, Eye, EyeOff } from 'lucide-react';

interface ApixEventStreamProps {
  className?: string;
  maxEvents?: number;
}

export default function ApixEventStream({ className = '', maxEvents = 100 }: ApixEventStreamProps) {
  const { isConnected, status } = useApixConnection();
  const [selectedChannel, setSelectedChannel] = useState<ApixChannel | 'all'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [userIdFilter, setUserIdFilter] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [displayedEvents, setDisplayedEvents] = useState<ApixEvent[]>([]);

  // Subscribe to events from all channels
  const agentEvents = useApixEvents({ 
    channel: APIX_CHANNELS.AGENT_EVENTS,
    includeHistory: true,
    historyLimit: 20
  });
  const toolEvents = useApixEvents({ 
    channel: APIX_CHANNELS.TOOL_EVENTS,
    includeHistory: true,
    historyLimit: 20
  });
  const workflowEvents = useApixEvents({ 
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    includeHistory: true,
    historyLimit: 20
  });
  const systemEvents = useApixEvents({ 
    channel: APIX_CHANNELS.SYSTEM_EVENTS,
    includeHistory: true,
    historyLimit: 20
  });
  const userEvents = useApixEvents({ 
    channel: APIX_CHANNELS.USER_EVENTS,
    includeHistory: true,
    historyLimit: 20
  });
  const customEvents = useApixEvents({ 
    channel: APIX_CHANNELS.CUSTOM,
    includeHistory: true,
    historyLimit: 20
  });
  const streamingEvents = useApixEvents({ 
    channel: APIX_CHANNELS.STREAMING,
    includeHistory: true,
    historyLimit: 20
  });

  // Combine all events
  const allEvents = [
    ...agentEvents,
    ...toolEvents,
    ...workflowEvents,
    ...systemEvents,
    ...userEvents,
    ...customEvents,
    ...streamingEvents
  ];

  // Filter and sort events
  useEffect(() => {
    if (isPaused) return;

    let filtered = [...allEvents];

    // Filter by channel
    if (selectedChannel !== 'all') {
      filtered = ApixEventFilter.byChannel(filtered, selectedChannel);
    }

    // Filter by event type
    if (eventTypeFilter !== 'all') {
      filtered = ApixEventFilter.byType(filtered, eventTypeFilter as any);
    }

    // Filter by user ID
    if (userIdFilter) {
      filtered = ApixEventFilter.byUserId(filtered, userIdFilter);
    }

    // Sort by timestamp (newest first)
    filtered = ApixEventFilter.sortByTimestamp(filtered, false);

    // Limit number of events
    filtered = filtered.slice(0, maxEvents);

    setDisplayedEvents(filtered);
  }, [allEvents, selectedChannel, eventTypeFilter, userIdFilter, isPaused, maxEvents]);

  const clearEvents = () => {
    setDisplayedEvents([]);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const getEventBadgeVariant = (event: ApixEvent) => {
    switch (event.priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'normal': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case APIX_CHANNELS.AGENT_EVENTS: return 'text-blue-600';
      case APIX_CHANNELS.TOOL_EVENTS: return 'text-green-600';
      case APIX_CHANNELS.WORKFLOW_EVENTS: return 'text-purple-600';
      case APIX_CHANNELS.SYSTEM_EVENTS: return 'text-red-600';
      case APIX_CHANNELS.USER_EVENTS: return 'text-orange-600';
      case APIX_CHANNELS.STREAMING: return 'text-cyan-600';
      default: return 'text-gray-600';
    }
  };

  const formatEventData = (data: any) => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className={`bg-white ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            APIX Event Stream
          </CardTitle>
          <CardDescription>
            Real-time stream of APIX events across all channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={togglePause}
              >
                {isPaused ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearEvents}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="channel-filter">Channel</Label>
              <Select value={selectedChannel} onValueChange={(value: any) => setSelectedChannel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value={APIX_CHANNELS.AGENT_EVENTS}>Agent Events</SelectItem>
                  <SelectItem value={APIX_CHANNELS.TOOL_EVENTS}>Tool Events</SelectItem>
                  <SelectItem value={APIX_CHANNELS.WORKFLOW_EVENTS}>Workflow Events</SelectItem>
                  <SelectItem value={APIX_CHANNELS.SYSTEM_EVENTS}>System Events</SelectItem>
                  <SelectItem value={APIX_CHANNELS.USER_EVENTS}>User Events</SelectItem>
                  <SelectItem value={APIX_CHANNELS.STREAMING}>Streaming</SelectItem>
                  <SelectItem value={APIX_CHANNELS.CUSTOM}>Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-filter">Event Type</Label>
              <Input
                id="type-filter"
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                placeholder="all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-filter">User ID</Label>
              <Input
                id="user-filter"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                placeholder="Filter by user ID"
              />
            </div>
          </div>

          {/* Event Count */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Showing {displayedEvents.length} events</span>
            {isPaused && <Badge variant="secondary">Paused</Badge>}
          </div>

          {/* Event Stream */}
          <ScrollArea className="h-96 border rounded-md">
            <div className="p-4 space-y-3">
              {displayedEvents.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {isConnected ? 'No events to display' : 'Connect to APIX to see events'}
                </div>
              ) : (
                displayedEvents.map((event, index) => (
                  <div
                    key={`${event.id}-${index}`}
                    className="border rounded-lg p-3 space-y-2 hover:bg-gray-50 transition-colors"
                  >
                    {/* Event Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={getEventBadgeVariant(event)}>
                          {event.type}
                        </Badge>
                        <span className={`text-sm font-medium ${getChannelColor(event.channel)}`}>
                          {event.channel}
                        </span>
                        {event.priority !== 'normal' && (
                          <Badge variant="outline" className="text-xs">
                            {event.priority}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {event.metadata.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Event Metadata */}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      <span>ID: {event.id.slice(-8)}</span>
                      {event.metadata.userId && (
                        <span>User: {event.metadata.userId}</span>
                      )}
                      {event.metadata.sessionId && (
                        <span>Session: {event.metadata.sessionId.slice(-8)}</span>
                      )}
                      {event.streamId && (
                        <span>Stream: {event.streamId.slice(-8)}</span>
                      )}
                      {event.chunkIndex !== undefined && (
                        <span>Chunk: {event.chunkIndex + 1}/{event.totalChunks}</span>
                      )}
                    </div>

                    {/* Event Data */}
                    {event.data && (
                      <div className="bg-gray-50 rounded p-2">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-hidden">
                          {formatEventData(event.data).slice(0, 200)}
                          {formatEventData(event.data).length > 200 && '...'}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}