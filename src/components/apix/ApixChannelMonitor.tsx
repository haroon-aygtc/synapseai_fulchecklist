/**
 * APIX Channel Monitor Component
 * 
 * Provides dedicated monitoring for each APIX channel with active subscriptions,
 * event volume, and performance metrics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useApixContext,
  useApixEvents,
  useApixMetrics,
  APIX_CHANNELS,
  ApixChannel,
  ApixEvent
} from '@/lib/apix';
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';

interface ChannelMetrics {
  channel: ApixChannel;
  subscriptions: number;
  eventCount: number;
  eventsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  lastEventTime?: Date;
  isActive: boolean;
}

interface ApixChannelMonitorProps {
  className?: string;
  refreshInterval?: number;
  showInactiveChannels?: boolean;
}

export default function ApixChannelMonitor({ 
  className = '',
  refreshInterval = 5000,
  showInactiveChannels = true
}: ApixChannelMonitorProps) {
  const { client, isConnected, status } = useApixContext();
  const metrics = useApixMetrics();
  const [selectedChannel, setSelectedChannel] = useState<ApixChannel>(APIX_CHANNELS.AGENT_EVENTS);
  const [channelMetrics, setChannelMetrics] = useState<Record<ApixChannel, ChannelMetrics>>({} as any);
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Subscribe to events from all channels for monitoring
  const agentEvents = useApixEvents({ 
    channel: APIX_CHANNELS.AGENT_EVENTS,
    includeHistory: true,
    historyLimit: 100
  });
  const toolEvents = useApixEvents({ 
    channel: APIX_CHANNELS.TOOL_EVENTS,
    includeHistory: true,
    historyLimit: 100
  });
  const workflowEvents = useApixEvents({ 
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    includeHistory: true,
    historyLimit: 100
  });
  const providerEvents = useApixEvents({ 
    channel: APIX_CHANNELS.PROVIDER_EVENTS,
    includeHistory: true,
    historyLimit: 100
  });
  const systemEvents = useApixEvents({ 
    channel: APIX_CHANNELS.SYSTEM_EVENTS,
    includeHistory: true,
    historyLimit: 100
  });
  const userEvents = useApixEvents({ 
    channel: APIX_CHANNELS.USER_EVENTS,
    includeHistory: true,
    historyLimit: 100
  });
  const organizationEvents = useApixEvents({ 
    channel: APIX_CHANNELS.ORGANIZATION_EVENTS,
    includeHistory: true,
    historyLimit: 100
  });
  const streamingEvents = useApixEvents({ 
    channel: APIX_CHANNELS.STREAMING,
    includeHistory: true,
    historyLimit: 100
  });
  const customEvents = useApixEvents({ 
    channel: APIX_CHANNELS.CUSTOM,
    includeHistory: true,
    historyLimit: 100
  });

  // Calculate channel metrics
  useEffect(() => {
    if (!isMonitoring) return;

    const calculateChannelMetrics = (channel: ApixChannel, events: ApixEvent[]): ChannelMetrics => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const recentEvents = events.filter(event => event.metadata.timestamp >= oneMinuteAgo);
      
      const errorEvents = events.filter(event => 
        event.type.includes('ERROR') || event.priority === 'critical'
      );

      const lastEvent = events.length > 0 ? events[events.length - 1] : null;
      
      return {
        channel,
        subscriptions: 0, // Would be populated from client subscription info
        eventCount: events.length,
        eventsPerSecond: recentEvents.length / 60,
        averageLatency: 0, // Would be calculated from event processing times
        errorRate: events.length > 0 ? errorEvents.length / events.length : 0,
        lastEventTime: lastEvent?.metadata.timestamp,
        isActive: recentEvents.length > 0
      };
    };

    const newMetrics: Record<ApixChannel, ChannelMetrics> = {
      [APIX_CHANNELS.AGENT_EVENTS]: calculateChannelMetrics(APIX_CHANNELS.AGENT_EVENTS, agentEvents),
      [APIX_CHANNELS.TOOL_EVENTS]: calculateChannelMetrics(APIX_CHANNELS.TOOL_EVENTS, toolEvents),
      [APIX_CHANNELS.WORKFLOW_EVENTS]: calculateChannelMetrics(APIX_CHANNELS.WORKFLOW_EVENTS, workflowEvents),
      [APIX_CHANNELS.PROVIDER_EVENTS]: calculateChannelMetrics(APIX_CHANNELS.PROVIDER_EVENTS, providerEvents),
      [APIX_CHANNELS.SYSTEM_EVENTS]: calculateChannelMetrics(APIX_CHANNELS.SYSTEM_EVENTS, systemEvents),
      [APIX_CHANNELS.USER_EVENTS]: calculateChannelMetrics(APIX_CHANNELS.USER_EVENTS, userEvents),
      [APIX_CHANNELS.ORGANIZATION_EVENTS]: calculateChannelMetrics(APIX_CHANNELS.ORGANIZATION_EVENTS, organizationEvents),
      [APIX_CHANNELS.STREAMING]: calculateChannelMetrics(APIX_CHANNELS.STREAMING, streamingEvents),
      [APIX_CHANNELS.CUSTOM]: calculateChannelMetrics(APIX_CHANNELS.CUSTOM, customEvents)
    };

    setChannelMetrics(newMetrics);
  }, [
    agentEvents, toolEvents, workflowEvents, providerEvents, systemEvents,
    userEvents, organizationEvents, streamingEvents, customEvents, isMonitoring
  ]);

  const getChannelDisplayName = (channel: ApixChannel): string => {
    return channel.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getChannelIcon = (channel: ApixChannel) => {
    switch (channel) {
      case APIX_CHANNELS.AGENT_EVENTS: return <Users className="h-4 w-4" />;
      case APIX_CHANNELS.TOOL_EVENTS: return <Zap className="h-4 w-4" />;
      case APIX_CHANNELS.WORKFLOW_EVENTS: return <BarChart3 className="h-4 w-4" />;
      case APIX_CHANNELS.PROVIDER_EVENTS: return <Activity className="h-4 w-4" />;
      case APIX_CHANNELS.SYSTEM_EVENTS: return <AlertTriangle className="h-4 w-4" />;
      case APIX_CHANNELS.USER_EVENTS: return <Users className="h-4 w-4" />;
      case APIX_CHANNELS.ORGANIZATION_EVENTS: return <Users className="h-4 w-4" />;
      case APIX_CHANNELS.STREAMING: return <TrendingUp className="h-4 w-4" />;
      case APIX_CHANNELS.CUSTOM: return <Activity className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: ApixChannel): string => {
    switch (channel) {
      case APIX_CHANNELS.AGENT_EVENTS: return 'text-blue-600';
      case APIX_CHANNELS.TOOL_EVENTS: return 'text-green-600';
      case APIX_CHANNELS.WORKFLOW_EVENTS: return 'text-purple-600';
      case APIX_CHANNELS.PROVIDER_EVENTS: return 'text-orange-600';
      case APIX_CHANNELS.SYSTEM_EVENTS: return 'text-red-600';
      case APIX_CHANNELS.USER_EVENTS: return 'text-cyan-600';
      case APIX_CHANNELS.ORGANIZATION_EVENTS: return 'text-indigo-600';
      case APIX_CHANNELS.STREAMING: return 'text-pink-600';
      case APIX_CHANNELS.CUSTOM: return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthStatus = (channelMetric: ChannelMetrics) => {
    if (!channelMetric.isActive) return { status: 'inactive', color: 'text-gray-500' };
    if (channelMetric.errorRate > 0.1) return { status: 'error', color: 'text-red-500' };
    if (channelMetric.errorRate > 0.05) return { status: 'warning', color: 'text-yellow-500' };
    return { status: 'healthy', color: 'text-green-500' };
  };

  const filteredChannels = useMemo(() => {
    const channels = Object.values(APIX_CHANNELS);
    if (showInactiveChannels) return channels;
    return channels.filter(channel => channelMetrics[channel]?.isActive);
  }, [channelMetrics, showInactiveChannels]);

  const selectedChannelMetric = channelMetrics[selectedChannel];
  const selectedChannelEvents = useMemo(() => {
    switch (selectedChannel) {
      case APIX_CHANNELS.AGENT_EVENTS: return agentEvents;
      case APIX_CHANNELS.TOOL_EVENTS: return toolEvents;
      case APIX_CHANNELS.WORKFLOW_EVENTS: return workflowEvents;
      case APIX_CHANNELS.PROVIDER_EVENTS: return providerEvents;
      case APIX_CHANNELS.SYSTEM_EVENTS: return systemEvents;
      case APIX_CHANNELS.USER_EVENTS: return userEvents;
      case APIX_CHANNELS.ORGANIZATION_EVENTS: return organizationEvents;
      case APIX_CHANNELS.STREAMING: return streamingEvents;
      case APIX_CHANNELS.CUSTOM: return customEvents;
      default: return [];
    }
  }, [selectedChannel, agentEvents, toolEvents, workflowEvents, providerEvents, systemEvents, userEvents, organizationEvents, streamingEvents, customEvents]);

  return (
    <div className={`bg-white ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              APIX Channel Monitor
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsMonitoring(!isMonitoring)}
              >
                {isMonitoring ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {isMonitoring ? 'Pause' : 'Resume'}
              </Button>
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {status}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Monitor active subscriptions, event volume, and performance metrics for each APIX channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedChannel} onValueChange={(value) => setSelectedChannel(value as ApixChannel)}>
            {/* Channel Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {filteredChannels.map((channel) => {
                const metric = channelMetrics[channel];
                const health = metric ? getHealthStatus(metric) : { status: 'inactive', color: 'text-gray-500' };
                
                return (
                  <Card 
                    key={channel}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedChannel === channel ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedChannel(channel)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={getChannelColor(channel)}>
                            {getChannelIcon(channel)}
                          </div>
                          <span className="font-medium text-sm">
                            {getChannelDisplayName(channel)}
                          </span>
                        </div>
                        <div className={health.color}>
                          {health.status === 'healthy' && <CheckCircle className="h-4 w-4" />}
                          {health.status === 'warning' && <AlertTriangle className="h-4 w-4" />}
                          {health.status === 'error' && <AlertTriangle className="h-4 w-4" />}
                          {health.status === 'inactive' && <Activity className="h-4 w-4" />}
                        </div>
                      </div>
                      
                      {metric && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Events</span>
                            <span className="font-mono">{metric.eventCount}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Events/sec</span>
                            <span className="font-mono">{metric.eventsPerSecond.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Error Rate</span>
                            <span className={`font-mono ${metric.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                              {(metric.errorRate * 100).toFixed(1)}%
                            </span>
                          </div>
                          {metric.lastEventTime && (
                            <div className="text-xs text-gray-500">
                              Last: {metric.lastEventTime.toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Detailed Channel View */}
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
              {filteredChannels.slice(0, 5).map((channel) => (
                <TabsTrigger key={channel} value={channel} className="text-xs">
                  {getChannelDisplayName(channel).split(' ')[0]}
                </TabsTrigger>
              ))}
            </TabsList>

            {filteredChannels.map((channel) => (
              <TabsContent key={channel} value={channel} className="space-y-4">
                {selectedChannelMetric && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedChannelMetric.eventCount}
                        </div>
                        <div className="text-sm text-gray-600">Total Events</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedChannelMetric.eventsPerSecond.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600">Events/Second</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl font-bold ${
                          selectedChannelMetric.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(selectedChannelMetric.errorRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">Error Rate</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {selectedChannelMetric.subscriptions}
                        </div>
                        <div className="text-sm text-gray-600">Subscriptions</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Recent Events */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Events</CardTitle>
                    <CardDescription>
                      Latest events from {getChannelDisplayName(channel)} channel
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {selectedChannelEvents.slice(-10).reverse().map((event, index) => (
                          <div
                            key={`${event.id}-${index}`}
                            className="flex items-center justify-between p-2 border rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant={event.priority === 'critical' ? 'destructive' : 'default'}>
                                {event.type}
                              </Badge>
                              {event.metadata.userId && (
                                <span className="text-xs text-gray-500">
                                  User: {event.metadata.userId.slice(-8)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {event.metadata.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                        {selectedChannelEvents.length === 0 && (
                          <div className="text-center text-gray-500 py-8">
                            No events in this channel
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}