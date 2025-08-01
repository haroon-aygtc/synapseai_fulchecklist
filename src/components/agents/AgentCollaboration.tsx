import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useApixContext } from '@/lib/apix/context';
import { useApixEvents, useApixPublish } from '@/lib/apix/hooks';
import { useApixCollaboration } from '@/lib/apix/streaming';
import { APIX_CHANNELS, ApixEvent } from '@/lib/apix/types';
import { useAuth } from '@/lib/auth/auth-context';
import { 
  Users, 
  MessageSquare, 
  Send, 
  Bot, 
  Zap, 
  MoreHorizontal, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Share2,
  UserPlus,
  X
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  status: 'idle' | 'busy' | 'error';
  capabilities: string[];
  lastActive?: Date;
}

interface Message {
  id: string;
  senderId: string;
  senderType: 'agent' | 'human' | 'system';
  senderName: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface CollaborationSession {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  participants: {
    agentIds: string[];
    userIds: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface AgentCollaborationProps {
  sessionId?: string;
  agents?: Agent[];
  onSessionCreate?: (session: CollaborationSession) => void;
  onSessionJoin?: (sessionId: string) => void;
  onSessionLeave?: (sessionId: string) => void;
  className?: string;
}

export default function AgentCollaboration({
  sessionId: initialSessionId,
  agents: initialAgents = [],
  onSessionCreate,
  onSessionJoin,
  onSessionLeave,
  className = ''
}: AgentCollaborationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected } = useApixContext();
  const publish = useApixPublish();
  
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isJoiningSession, setIsJoiningSession] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [sessionToJoin, setSessionToJoin] = useState('');
  const [activeSessions, setActiveSessions] = useState<CollaborationSession[]>([]);
  const [currentSession, setCurrentSession] = useState<CollaborationSession | null>(null);
  const [tab, setTab] = useState<string>(sessionId ? 'collaboration' : 'create');

  // Subscribe to agent events
  const agentEvents = useApixEvents({
    channel: APIX_CHANNELS.AGENT_EVENTS,
    includeHistory: true,
    historyLimit: 50
  });

  // Subscribe to collaboration events for the current session
  const collaborationEvents = useApixEvents({
    channel: APIX_CHANNELS.AGENT_EVENTS,
    filters: { sessionId },
    includeHistory: true,
    historyLimit: 100
  });

  // Use collaboration hook for real-time features
  const { participants, isJoined } = useApixCollaboration(sessionId || '');

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      if (!isConnected || agents.length > 0) return;
      
      setIsLoadingAgents(true);
      
      try {
        // Request agents list
        publish({
          type: 'AGENT_LIST_REQUEST',
          channel: APIX_CHANNELS.AGENT_EVENTS,
          data: { includeStatus: true }
        });
      } catch (error) {
        console.error('Failed to load agents:', error);
        toast({
          title: 'Error',
          description: 'Failed to load agents. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setIsLoadingAgents(false);
      }
    };
    
    loadAgents();
  }, [isConnected, agents.length, publish, toast]);

  // Process agent events
  useEffect(() => {
    for (const event of agentEvents) {
      if (event.type === 'AGENT_LIST_RESPONSE') {
        setAgents(event.data.agents || []);
      } else if (event.type === 'AGENT_STATUS_CHANGED') {
        setAgents(prev => 
          prev.map(agent => 
            agent.id === event.data.agentId 
              ? { ...agent, status: event.data.status } 
              : agent
          )
        );
      } else if (event.type === 'COLLABORATION_SESSIONS_LIST') {
        setActiveSessions(event.data.sessions || []);
      }
    }
  }, [agentEvents]);

  // Process collaboration events
  useEffect(() => {
    for (const event of collaborationEvents) {
      if (event.type === 'COLLABORATION_MESSAGE') {
        const message: Message = {
          id: event.id,
          senderId: event.data.senderId,
          senderType: event.data.senderType,
          senderName: event.data.senderName,
          content: event.data.content,
          timestamp: new Date(event.metadata.timestamp),
          metadata: event.data.metadata
        };
        
        setMessages(prev => [...prev, message]);
      } else if (event.type === 'COLLABORATION_SESSION_UPDATED') {
        setCurrentSession(event.data.session);
      } else if (event.type === 'COLLABORATION_SESSION_ENDED') {
        if (event.data.sessionId === sessionId) {
          toast({
            title: 'Session Ended',
            description: 'The collaboration session has ended.',
          });
          
          setSessionId(undefined);
          setCurrentSession(null);
          setMessages([]);
          setTab('create');
          
          onSessionLeave?.(event.data.sessionId);
        }
      }
    }
  }, [collaborationEvents, sessionId, toast, onSessionLeave]);

  // Load active sessions
  useEffect(() => {
    if (isConnected && !sessionId) {
      publish({
        type: 'COLLABORATION_SESSIONS_LIST_REQUEST',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: {}
      });
    }
  }, [isConnected, sessionId, publish]);

  // Load session details when joining
  useEffect(() => {
    if (sessionId && isConnected) {
      publish({
        type: 'COLLABORATION_SESSION_JOIN',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: { sessionId }
      });
    }
  }, [sessionId, isConnected, publish]);

  // Handle agent selection
  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  // Create new collaboration session
  const createSession = async () => {
    if (!sessionName || selectedAgents.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a session name and select at least one agent.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsCreatingSession(true);
    
    try {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const session: CollaborationSession = {
        id: newSessionId,
        name: sessionName,
        description: sessionDescription,
        status: 'active',
        participants: {
          agentIds: selectedAgents,
          userIds: [user?.id || 'unknown']
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user?.id || 'unknown'
      };
      
      // Create session
      publish({
        type: 'COLLABORATION_SESSION_CREATE',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: { session }
      });
      
      // Add system message
      const systemMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        senderId: 'system',
        senderType: 'system',
        senderName: 'System',
        content: `Collaboration session "${sessionName}" created with ${selectedAgents.length} agents.`,
        timestamp: new Date()
      };
      
      setMessages([systemMessage]);
      setSessionId(newSessionId);
      setCurrentSession(session);
      setTab('collaboration');
      
      onSessionCreate?.(session);
      
      toast({
        title: 'Session Created',
        description: 'Collaboration session created successfully.',
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create collaboration session. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Join existing session
  const joinSession = async () => {
    if (!sessionToJoin) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a session ID to join.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsJoiningSession(true);
    
    try {
      publish({
        type: 'COLLABORATION_SESSION_JOIN',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: { sessionId: sessionToJoin }
      });
      
      setSessionId(sessionToJoin);
      setTab('collaboration');
      
      onSessionJoin?.(sessionToJoin);
      
      toast({
        title: 'Session Joined',
        description: 'Joined collaboration session successfully.',
      });
    } catch (error) {
      console.error('Failed to join session:', error);
      toast({
        title: 'Error',
        description: 'Failed to join collaboration session. Please check the session ID and try again.',
        variant: 'destructive'
      });
    } finally {
      setIsJoiningSession(false);
    }
  };

  // Leave current session
  const leaveSession = () => {
    if (!sessionId) return;
    
    try {
      publish({
        type: 'COLLABORATION_SESSION_LEAVE',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: { sessionId }
      });
      
      setSessionId(undefined);
      setCurrentSession(null);
      setMessages([]);
      setTab('create');
      
      onSessionLeave?.(sessionId);
      
      toast({
        title: 'Session Left',
        description: 'Left collaboration session successfully.',
      });
    } catch (error) {
      console.error('Failed to leave session:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave collaboration session.',
        variant: 'destructive'
      });
    }
  };

  // End current session
  const endSession = () => {
    if (!sessionId) return;
    
    try {
      publish({
        type: 'COLLABORATION_SESSION_END',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: { sessionId }
      });
      
      setSessionId(undefined);
      setCurrentSession(null);
      setMessages([]);
      setTab('create');
      
      onSessionLeave?.(sessionId);
      
      toast({
        title: 'Session Ended',
        description: 'Collaboration session ended successfully.',
      });
    } catch (error) {
      console.error('Failed to end session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end collaboration session.',
        variant: 'destructive'
      });
    }
  };

  // Send message
  const sendMessage = () => {
    if (!newMessage.trim() || !sessionId) return;
    
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      publish({
        type: 'COLLABORATION_MESSAGE',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: {
          sessionId,
          messageId,
          senderId: user?.id || 'unknown',
          senderType: 'human',
          senderName: user ? `${user.firstName} ${user.lastName}` : 'User',
          content: newMessage,
          metadata: {
            isDirective: true
          }
        }
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Join an active session from the list
  const joinActiveSession = (session: CollaborationSession) => {
    setSessionToJoin(session.id);
    joinSession();
  };

  // Render agent status badge
  const renderAgentStatus = (status: string) => {
    switch (status) {
      case 'idle':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Idle</Badge>;
      case 'busy':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Busy</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Render message sender avatar
  const renderMessageAvatar = (message: Message) => {
    switch (message.senderType) {
      case 'agent':
        return (
          <Avatar className="h-8 w-8">
            <AvatarImage src={agents.find(a => a.id === message.senderId)?.avatar} />
            <AvatarFallback className="bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        );
      case 'human':
        return (
          <Avatar className="h-8 w-8">
            <AvatarImage src={message.senderId === user?.id ? user?.avatar : undefined} />
            <AvatarFallback className="bg-blue-100 text-blue-800">
              {message.senderName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        );
      case 'system':
        return (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gray-100 text-gray-800">
              <Zap className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        );
      default:
        return (
          <Avatar className="h-8 w-8">
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
        );
    }
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Agent Collaboration</CardTitle>
            <CardDescription>
              {sessionId 
                ? `Session: ${currentSession?.name || sessionId}`
                : 'Create or join a collaboration session'}
            </CardDescription>
          </div>
          {sessionId && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Users className="h-3 w-3 mr-1" />
                {participants.length} participants
              </Badge>
              <Button variant="outline" size="sm" onClick={leaveSession}>
                Leave
              </Button>
              {currentSession?.createdBy === user?.id && (
                <Button variant="destructive" size="sm" onClick={endSession}>
                  End Session
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          {!sessionId && (
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">Create Session</TabsTrigger>
              <TabsTrigger value="join">Join Session</TabsTrigger>
              <TabsTrigger value="active">Active Sessions</TabsTrigger>
            </TabsList>
          )}
          
          {/* Create Session Tab */}
          <TabsContent value="create" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="session-name" className="text-sm font-medium">
                  Session Name
                </label>
                <Input
                  id="session-name"
                  placeholder="Enter session name"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="session-description" className="text-sm font-medium">
                  Description (Optional)
                </label>
                <Textarea
                  id="session-description"
                  placeholder="Enter session description"
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Select Agents</label>
                <div className="mt-2 border rounded-md">
                  <ScrollArea className="h-64">
                    <div className="p-2 space-y-2">
                      {isLoadingAgents ? (
                        <div className="flex items-center justify-center h-32">
                          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                          <span className="ml-2">Loading agents...</span>
                        </div>
                      ) : agents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-gray-500">No agents available</p>
                        </div>
                      ) : (
                        agents.map((agent) => (
                          <div
                            key={agent.id}
                            className={`p-3 rounded-md border cursor-pointer transition-colors ${
                              selectedAgents.includes(agent.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => toggleAgentSelection(agent.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={agent.avatar} />
                                  <AvatarFallback className="bg-primary/10 text-primary">
                                    <Bot className="h-4 w-4" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{agent.name}</p>
                                  <p className="text-xs text-gray-500 line-clamp-1">
                                    {agent.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {renderAgentStatus(agent.status)}
                                {selectedAgents.includes(agent.id) && (
                                  <CheckCircle2 className="h-5 w-5 text-primary" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              onClick={createSession} 
              disabled={isCreatingSession || !sessionName || selectedAgents.length === 0}
            >
              {isCreatingSession && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Create Collaboration Session
            </Button>
          </TabsContent>
          
          {/* Join Session Tab */}
          <TabsContent value="join" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="session-id" className="text-sm font-medium">
                  Session ID
                </label>
                <div className="flex space-x-2">
                  <Input
                    id="session-id"
                    placeholder="Enter session ID"
                    value={sessionToJoin}
                    onChange={(e) => setSessionToJoin(e.target.value)}
                  />
                  <Button 
                    onClick={joinSession} 
                    disabled={isJoiningSession || !sessionToJoin}
                  >
                    {isJoiningSession && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Join
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Active Sessions Tab */}
          <TabsContent value="active" className="space-y-4">
            <div className="border rounded-md">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-2">
                  {activeSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <Clock className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-gray-500">No active sessions</p>
                    </div>
                  ) : (
                    activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-3 rounded-md border border-gray-200 hover:border-gray-300"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{session.name}</p>
                            <p className="text-xs text-gray-500">
                              {session.description || 'No description'}
                            </p>
                            <div className="flex items-center mt-1 space-x-2">
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {session.participants.agentIds.length + session.participants.userIds.length} participants
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Created {new Date(session.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => joinActiveSession(session)}
                          >
                            Join
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
          
          {/* Collaboration Tab */}
          <TabsContent value="collaboration" className="space-y-4">
            {sessionId && (
              <div className="flex flex-col h-[500px]">
                <div className="flex-1 border rounded-md overflow-hidden">
                  <ScrollArea className="h-full p-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <MessageSquare className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-gray-500">No messages yet</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div key={message.id} className="flex space-x-3">
                            {renderMessageAvatar(message)}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{message.senderName}</span>
                                <span className="text-xs text-gray-500">
                                  {message.timestamp.toLocaleTimeString()}
                                </span>
                                {message.metadata?.isDirective && (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    Directive
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 text-sm whitespace-pre-wrap">{message.content}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
                
                <div className="mt-4 flex space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                
                {currentSession && (
                  <div className="mt-4">
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium">Participants</h4>
                        <Badge variant="outline" className="text-xs">
                          {participants.length}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Invite
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {currentSession.participants.agentIds.map((agentId) => {
                        const agent = agents.find(a => a.id === agentId);
                        return (
                          <Badge key={agentId} variant="outline" className="flex items-center gap-1 bg-primary/5">
                            <Bot className="h-3 w-3" />
                            {agent?.name || 'Unknown Agent'}
                          </Badge>
                        );
                      })}
                      {participants.map((userId) => (
                        <Badge key={userId} variant="outline" className="flex items-center gap-1 bg-blue-50">
                          {userId === user?.id ? (
                            <>
                              <span className="h-2 w-2 rounded-full bg-green-500" />
                              You
                            </>
                          ) : (
                            <>
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              User
                            </>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <div className="text-xs text-gray-500">
          {isConnected ? (
            <span className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-1" />
              Connected to APIX
            </span>
          ) : (
            <span className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-red-500 mr-1" />
              Disconnected
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}