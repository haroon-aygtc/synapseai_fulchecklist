/**
 * APIX Event Publisher Component
 * 
 * This component provides a UI for publishing APIX events.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApixPublish, useApixConnection, APIX_CHANNELS, ApixEventFactory } from '@/lib/apix';
import { Activity, Send, Zap } from 'lucide-react';

interface ApixEventPublisherProps {
  className?: string;
}

export default function ApixEventPublisher({ className = '' }: ApixEventPublisherProps) {
  const { isConnected, status } = useApixConnection();
  const publish = useApixPublish();
  
  const [eventType, setEventType] = useState('CUSTOM_EVENT');
  const [channel, setChannel] = useState(APIX_CHANNELS.CUSTOM);
  const [eventData, setEventData] = useState('{}');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [publishedEvents, setPublishedEvents] = useState<string[]>([]);

  const handlePublishEvent = () => {
    try {
      let data;
      try {
        data = JSON.parse(eventData);
      } catch {
        data = { message: eventData };
      }

      const eventId = publish({
        type: eventType as any,
        channel,
        data,
        priority,
        metadata: {
          timestamp: new Date(),
          source: 'event-publisher-component'
        }
      });

      setPublishedEvents(prev => [eventId, ...prev.slice(0, 9)]);
      
      // Reset form
      setEventData('{}');
    } catch (error) {
      console.error('Failed to publish event:', error);
    }
  };

  const handleQuickEvent = (type: 'agent' | 'tool' | 'workflow') => {
    let event;
    switch (type) {
      case 'agent':
        event = ApixEventFactory.agentMessage(
          'demo-agent-1',
          'Hello from the event publisher!',
          'demo-session-1',
          { userId: 'demo-user', organizationId: 'demo-org' }
        );
        break;
      case 'tool':
        event = ApixEventFactory.toolExecuted(
          'demo-tool-1',
          { query: 'test input' },
          { result: 'test output' },
          150,
          { userId: 'demo-user', organizationId: 'demo-org' }
        );
        break;
      case 'workflow':
        event = ApixEventFactory.workflowStarted(
          'demo-workflow-1',
          'demo-execution-1',
          { userId: 'demo-user', organizationId: 'demo-org' }
        );
        break;
    }

    const eventId = publish(event);
    setPublishedEvents(prev => [eventId, ...prev.slice(0, 9)]);
  };

  return (
    <div className={`bg-white ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            APIX Event Publisher
          </CardTitle>
          <CardDescription>
            Publish events to the APIX system for testing and development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">Connection Status:</span>
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {status}
            </Badge>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Events</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuickEvent('agent')}
                disabled={!isConnected}
              >
                Agent Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuickEvent('tool')}
                disabled={!isConnected}
              >
                Tool Execution
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuickEvent('workflow')}
                disabled={!isConnected}
              >
                Workflow Start
              </Button>
            </div>
          </div>

          {/* Custom Event Form */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Custom Event</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-type">Event Type</Label>
                <Input
                  id="event-type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="CUSTOM_EVENT"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={APIX_CHANNELS.AGENT_EVENTS}>Agent Events</SelectItem>
                    <SelectItem value={APIX_CHANNELS.TOOL_EVENTS}>Tool Events</SelectItem>
                    <SelectItem value={APIX_CHANNELS.WORKFLOW_EVENTS}>Workflow Events</SelectItem>
                    <SelectItem value={APIX_CHANNELS.SYSTEM_EVENTS}>System Events</SelectItem>
                    <SelectItem value={APIX_CHANNELS.USER_EVENTS}>User Events</SelectItem>
                    <SelectItem value={APIX_CHANNELS.CUSTOM}>Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-data">Event Data (JSON)</Label>
              <Textarea
                id="event-data"
                value={eventData}
                onChange={(e) => setEventData(e.target.value)}
                placeholder='{"message": "Hello, APIX!"}'
                rows={4}
              />
            </div>

            <Button
              onClick={handlePublishEvent}
              disabled={!isConnected}
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Publish Event
            </Button>
          </div>

          {/* Published Events */}
          {publishedEvents.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Recently Published</Label>
              <div className="space-y-1">
                {publishedEvents.map((eventId, index) => (
                  <div
                    key={eventId}
                    className="text-xs font-mono bg-gray-50 p-2 rounded border"
                  >
                    {eventId}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}