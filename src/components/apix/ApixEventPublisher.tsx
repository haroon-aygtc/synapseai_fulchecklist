/**
 * APIX Event Publisher Component
 * 
 * This component provides a UI for publishing APIX events.
 */

import React, { useState } from 'react';
import { useApixPublish, EventChannel, EventType } from '@/lib/apix';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';

interface ApixEventPublisherProps {
  defaultChannel?: EventChannel;
  defaultType?: EventType;
  sessionId?: string;
  className?: string;
}

export function ApixEventPublisher({
  defaultChannel = 'system-events',
  defaultType = 'state_update',
  sessionId,
  className = ''
}: ApixEventPublisherProps) {
  const publish = useApixPublish();
  const [channel, setChannel] = useState<EventChannel>(defaultChannel);
  const [type, setType] = useState<EventType>(defaultType);
  const [data, setData] = useState('{}');
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  // Available channels
  const channels: EventChannel[] = [
    'agent-events',
    'tool-events',
    'workflow-events',
    'provider-events',
    'system-events'
  ];

  // Available event types
  const eventTypes: EventType[] = [
    'tool_call_start',
    'tool_call_result',
    'tool_call_error',
    'thinking_status',
    'text_chunk',
    'state_update',
    'request_user_input',
    'session_start',
    'session_end',
    'error_occurred',
    'fallback_triggered'
  ];

  // Handle publishing event
  const handlePublish = () => {
    try {
      setIsPublishing(true);
      
      // Parse data JSON
      const parsedData = JSON.parse(data);
      
      // Create event
      const event = {
        type,
        channel,
        sessionId,
        data: parsedData
      };
      
      // Publish event
      const eventId = publish(event);
      setLastEventId(eventId);
      
      // Reset form
      // setData('{}');
    } catch (error) {
      console.error('Failed to publish event:', error);
      alert(`Failed to publish event: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Publish Event</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="channel">Channel</Label>
            <Select
              value={channel}
              onValueChange={(value) => setChannel(value as EventChannel)}
            >
              <SelectTrigger id="channel">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Event Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as EventType)}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {sessionId && (
          <div className="space-y-2">
            <Label htmlFor="sessionId">Session ID</Label>
            <Input
              id="sessionId"
              value={sessionId}
              disabled
            />
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="data">Event Data (JSON)</Label>
          <Textarea
            id="data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {lastEventId && (
          <p className="text-xs text-muted-foreground">
            Last event ID: {lastEventId}
          </p>
        )}
        <Button onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Publish Event
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}