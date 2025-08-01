/**
 * APIX Event Stream Component
 * 
 * This component displays a real-time stream of APIX events.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useApixEvents, ApixEvent, EventChannel, EventType } from '@/lib/apix';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface ApixEventStreamProps {
  channels?: EventChannel[];
  types?: EventType[];
  sessionId?: string;
  maxEvents?: number;
  title?: string;
  height?: string;
  className?: string;
}

export function ApixEventStream({
  channels,
  types,
  sessionId,
  maxEvents = 100,
  title = 'Event Stream',
  height = '400px',
  className = ''
}: ApixEventStreamProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Create subscription options
  const subscriptionOptions = {
    ...(channels && channels.length === 1 ? { channel: channels[0] } : {}),
    ...(types && types.length === 1 ? { type: types[0] } : {}),
    ...(sessionId ? { sessionId } : {})
  };
  
  // Subscribe to events
  const events = useApixEvents<ApixEvent>(subscriptionOptions);
  
  // Filter events if multiple channels or types are specified
  const filteredEvents = events.filter(event => {
    if (channels && channels.length > 0 && !channels.includes(event.channel)) {
      return false;
    }
    if (types && types.length > 0 && !types.includes(event.type)) {
      return false;
    }
    return true;
  }).slice(-maxEvents);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [filteredEvents, autoScroll]);

  // Handle scroll to detect if user has scrolled up
  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    
    setAutoScroll(isAtBottom);
  };

  // Get channel color
  const getChannelColor = (channel: EventChannel) => {
    switch (channel) {
      case 'agent-events': return 'bg-blue-500';
      case 'tool-events': return 'bg-green-500';
      case 'workflow-events': return 'bg-purple-500';
      case 'provider-events': return 'bg-yellow-500';
      case 'system-events': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Format event timestamp
  const formatTimestamp = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea 
          ref={scrollAreaRef} 
          className="h-[400px]" 
          style={{ height }} 
          onScroll={handleScroll}
        >
          {filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No events yet
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="p-3 border rounded-md bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={`${getChannelColor(event.channel)} text-white`}
                      >
                        {event.channel}
                      </Badge>
                      <Badge variant="outline">{event.type}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}