/**
 * APIX Dashboard Page
 * 
 * Comprehensive dashboard for APIX system monitoring and management.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ApixStatus,
  ApixEventStream,
  ApixEventPublisher,
  ApixChannelMonitor,
  ApixEventPlayback,
  ApixEventFilter,
  ApixConnectionManager
} from '@/components/apix';
import { ApixProvider } from '@/lib/apix/context';
import { useApixEvents, APIX_CHANNELS } from '@/lib/apix';
import { 
  Activity, 
  Monitor, 
  Settings, 
  Filter,
  Play,
  Send,
  BarChart3,
  Zap
} from 'lucide-react';

export default function ApixDashboard() {
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
  
  // Get all events for filtering
  const allEvents = [
    ...useApixEvents({ channel: APIX_CHANNELS.AGENT_EVENTS, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.TOOL_EVENTS, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.WORKFLOW_EVENTS, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.PROVIDER_EVENTS, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.SYSTEM_EVENTS, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.USER_EVENTS, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.ORGANIZATION_EVENTS, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.STREAMING, includeHistory: true, historyLimit: 50 }),
    ...useApixEvents({ channel: APIX_CHANNELS.CUSTOM, includeHistory: true, historyLimit: 50 })
  ].sort((a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime());

  return (
    <ApixProvider autoConnect={false}>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">APIX Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Real-time monitoring and management for the APIX protocol system
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Activity className="h-4 w-4 mr-2" />
              SynapseAI APIX
            </Badge>
          </div>

          {/* Main Dashboard Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="connection" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Connection
              </TabsTrigger>
              <TabsTrigger value="channels" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Channels
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Events
              </TabsTrigger>
              <TabsTrigger value="filter" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </TabsTrigger>
              <TabsTrigger value="playback" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Playback
              </TabsTrigger>
              <TabsTrigger value="publisher" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Publisher
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ApixStatus showDetailedMetrics={true} />
                <ApixConnectionManager showAdvancedSettings={false} />
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                <ApixChannelMonitor />
              </div>
            </TabsContent>

            {/* Connection Tab */}
            <TabsContent value="connection" className="space-y-6">
              <ApixConnectionManager showAdvancedSettings={true} />
            </TabsContent>

            {/* Channels Tab */}
            <TabsContent value="channels" className="space-y-6">
              <ApixChannelMonitor />
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-6">
              <ApixEventStream maxEvents={200} />
            </TabsContent>

            {/* Filter Tab */}
            <TabsContent value="filter" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ApixEventFilter
                    events={allEvents}
                    onFilteredEvents={setFilteredEvents}
                    showPreview={true}
                  />
                </div>
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Filter Results</CardTitle>
                      <CardDescription>
                        Events matching your current filters
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Total Events:</span>
                          <Badge variant="secondary">{allEvents.length}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Filtered Events:</span>
                          <Badge variant="default">{filteredEvents.length}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Filter Efficiency:</span>
                          <Badge variant="outline">
                            {allEvents.length > 0 
                              ? ((filteredEvents.length / allEvents.length) * 100).toFixed(1)
                              : 0
                            }%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Playback Tab */}
            <TabsContent value="playback" className="space-y-6">
              <ApixEventPlayback maxRecordingDuration={600000} />
            </TabsContent>

            {/* Publisher Tab */}
            <TabsContent value="publisher" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ApixEventPublisher />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Publishing Guidelines</CardTitle>
                    <CardDescription>
                      Best practices for publishing APIX events
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Event Types</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Use descriptive event types (e.g., AGENT_MESSAGE_SENT)</li>
                        <li>• Follow the existing naming conventions</li>
                        <li>• Include relevant metadata for debugging</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Channels</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Agent events: agent-events channel</li>
                        <li>• Tool executions: tool-events channel</li>
                        <li>• Workflow updates: workflow-events channel</li>
                        <li>• System notifications: system-events channel</li>
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Priority Levels</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Critical: System failures, security issues</li>
                        <li>• High: Important state changes</li>
                        <li>• Normal: Regular operations (default)</li>
                        <li>• Low: Debug information, metrics</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ApixProvider>
  );
}