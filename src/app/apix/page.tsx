"use client";

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ApixEventStream, ApixEventPublisher } from '@/components/apix';
import { useApixConnection, useApixRoom, EventChannel } from '@/lib/apix';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function ApixDebugPage() {
  const { status, connect, disconnect, isConnected } = useApixConnection(true);
  const [sessionId, setSessionId] = useState<string>(uuidv4());
  const [roomId, setRoomId] = useState<string>('');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<EventChannel[]>([]);
  const { roomId: connectedRoomId } = useApixRoom(activeRoom);

  // Available channels
  const channels: EventChannel[] = [
    'agent-events',
    'tool-events',
    'workflow-events',
    'provider-events',
    'system-events'
  ];

  // Toggle channel selection
  const toggleChannel = (channel: EventChannel) => {
    setSelectedChannels(prev => 
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  // Generate new session ID
  const generateNewSessionId = () => {
    setSessionId(uuidv4());
  };

  // Join room
  const joinRoom = () => {
    if (roomId) {
      setActiveRoom(roomId);
    }
  };

  // Leave room
  const leaveRoom = () => {
    setActiveRoom(null);
  };

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">APIX Debug Console</h1>
          <p className="text-muted-foreground">
            Monitor and interact with the real-time event system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isConnected ? "outline" : "default"}
            onClick={isConnected ? disconnect : connect}
            className="gap-2"
          >
            {status === 'connecting' || status === 'reconnecting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isConnected ? (
              <WifiOff className="h-4 w-4" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            {isConnected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Event Stream</CardTitle>
            <CardDescription>
              Real-time events from the APIX protocol
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {channels.map(channel => (
                  <Button
                    key={channel}
                    variant={selectedChannels.includes(channel) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleChannel(channel)}
                    className="text-xs"
                  >
                    {channel}
                  </Button>
                ))}
              </div>
              
              <ApixEventStream
                channels={selectedChannels.length > 0 ? selectedChannels : undefined}
                sessionId={sessionId}
                height="500px"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session Control</CardTitle>
              <CardDescription>
                Manage your event session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sessionId">Session ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="sessionId"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={generateNewSessionId}
                    title="Generate new session ID"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="roomId">Room ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter room ID"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={joinRoom}
                    disabled={!roomId || activeRoom === roomId}
                    className="w-full"
                    size="sm"
                  >
                    Join Room
                  </Button>
                  <Button
                    variant="outline"
                    onClick={leaveRoom}
                    disabled={!activeRoom}
                    className="w-full"
                    size="sm"
                  >
                    Leave Room
                  </Button>
                </div>
                {activeRoom && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Connected to room: <span className="font-mono">{activeRoom}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="publish">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="publish">Publish</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="publish" className="pt-4">
              <ApixEventPublisher
                sessionId={sessionId}
              />
            </TabsContent>
            <TabsContent value="templates" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Event Templates</CardTitle>
                  <CardDescription>
                    Common event patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-2">
                    <Button variant="outline" className="justify-start">
                      Tool Call Sequence
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Agent Thinking
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Workflow State Change
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Provider Fallback
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Session Start/End
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}