import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  MessageSquare, 
  Send, 
  UserPlus, 
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Bot,
  User
} from 'lucide-react';
import { useEventSystemFromContext } from '../context/event-context';
import { useAgentCollaboration } from '../hooks/event-hooks';

export interface AgentCollaborationProps {
  agentId: string;
  agentName?: string;
  className?: string;
  onCollaborationStart?: (collaborationId: string) => void;
  onCollaborationEnd?: (collaborationId: string) => void;
  onMessageReceived?: (message: any) => void;
}

interface CollaborationRequest {
  id: string;
  fromAgentId: string;
  fromAgentName?: string;
  collaborationId: string;
  context: any;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
}

export function AgentCollaboration({
  agentId,
  agentName = 'Agent',
  className = '',
  onCollaborationStart,
  onCollaborationEnd,
  onMessageReceived
}: AgentCollaborationProps) {
  const eventSystem = useEventSystemFromContext();
  const [selectedCollaboration, setSelectedCollaboration] = useState<string | null>(null);
  const [newCollaboratorId, setNewCollaboratorId] = useState('');
  const [collaborationContext, setCollaborationContext] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [collaborationRequests, setCollaborationRequests] = useState<CollaborationRequest[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    collaborations,
    initiateCollaboration,
    sendMessage,
    endCollaboration,
    onCollaborationRequest,
    onCollaborationMessage
  } = useAgentCollaboration(eventSystem, agentId);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [collaborations, selectedCollaboration]);

  // Set up collaboration event listeners
  useEffect(() => {
    const unsubscribers = [
      onCollaborationRequest((data) => {
        const request: CollaborationRequest = {
          id: `req-${Date.now()}-${Math.random()}`,
          fromAgentId: data.fromAgentId,
          fromAgentName: data.fromAgentName || data.fromAgentId,
          collaborationId: data.collaborationId,
          context: data.context,
          timestamp: new Date(),
          status: 'pending'
        };
        
        setCollaborationRequests(prev => [...prev, request]);
      }),

      onCollaborationMessage((data) => {
        if (onMessageReceived) {
          onMessageReceived(data);
        }
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onCollaborationRequest, onCollaborationMessage, onMessageReceived]);

  const handleStartCollaboration = async () => {
    if (!newCollaboratorId.trim()) return;

    try {
      const collaboratorIds = newCollaboratorId.split(',').map(id => id.trim());
      const context = collaborationContext.trim() || 'General collaboration';
      
      const collaborationId = await initiateCollaboration(collaboratorIds, { 
        purpose: context,
        initiatedBy: agentId,
        initiatedAt: new Date()
      });

      if (onCollaborationStart) {
        onCollaborationStart(collaborationId);
      }

      setNewCollaboratorId('');
      setCollaborationContext('');
      setSelectedCollaboration(collaborationId);
    } catch (error) {
      console.error('Failed to start collaboration:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedCollaboration) return;

    const collaboration = collaborations.get(selectedCollaboration);
    if (!collaboration) return;

    try {
      // Send to all collaborators except self
      const otherCollaborators = collaboration.collaborators.filter((id: string) => id !== agentId);
      
      for (const collaboratorId of otherCollaborators) {
        await sendMessage(selectedCollaboration, collaboratorId, messageInput);
      }

      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEndCollaboration = async (collaborationId: string) => {
    try {
      await endCollaboration(collaborationId);
      
      if (onCollaborationEnd) {
        onCollaborationEnd(collaborationId);
      }

      if (selectedCollaboration === collaborationId) {
        setSelectedCollaboration(null);
      }
    } catch (error) {
      console.error('Failed to end collaboration:', error);
    }
  };

  const handleAcceptRequest = async (request: CollaborationRequest) => {
    try {
      // Accept the collaboration by sending a response
      await eventSystem.publishAgentCollaborationEvent('COLLABORATION_RESPONSE', {
        fromAgentId: agentId,
        toAgentId: request.fromAgentId,
        collaborationId: request.collaborationId,
        context: { accepted: true }
      });

      // Update request status
      setCollaborationRequests(prev => 
        prev.map(req => 
          req.id === request.id 
            ? { ...req, status: 'accepted' }
            : req
        )
      );
    } catch (error) {
      console.error('Failed to accept collaboration request:', error);
    }
  };

  const handleRejectRequest = async (request: CollaborationRequest) => {
    try {
      // Reject the collaboration by sending a response
      await eventSystem.publishAgentCollaborationEvent('COLLABORATION_RESPONSE', {
        fromAgentId: agentId,
        toAgentId: request.fromAgentId,
        collaborationId: request.collaborationId,
        context: { accepted: false }
      });

      // Update request status
      setCollaborationRequests(prev => 
        prev.map(req => 
          req.id === request.id 
            ? { ...req, status: 'rejected' }
            : req
        )
      );
    } catch (error) {
      console.error('Failed to reject collaboration request:', error);
    }
  };

  const getCollaborationStatus = (collaboration: any) => {
    switch (collaboration.status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'ended':
        return <Badge variant="secondary">Ended</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const selectedCollaborationData = selectedCollaboration 
    ? collaborations.get(selectedCollaboration) 
    : null;

  const activeCollaborations = Array.from(collaborations.values())
    .filter((c: any) => c.status === 'active');
  
  const endedCollaborations = Array.from(collaborations.values())
    .filter((c: any) => c.status === 'ended');

  return (
    <div className={`bg-white space-y-6 ${className}`}>
      {/* Collaboration Requests */}
      {collaborationRequests.filter(req => req.status === 'pending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <span>Collaboration Requests</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {collaborationRequests
              .filter(req => req.status === 'pending')
              .map((request) => (
                <Alert key={request.id}>
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {request.fromAgentName} wants to collaborate
                      </p>
                      <p className="text-sm text-gray-600">
                        Context: {request.context?.purpose || 'No context provided'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRequest(request)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectRequest(request)}
                      >
                        Reject
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Start New Collaboration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Start New Collaboration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Collaborator Agent IDs (comma-separated)
            </label>
            <Input
              value={newCollaboratorId}
              onChange={(e) => setNewCollaboratorId(e.target.value)}
              placeholder="agent-1, agent-2, agent-3"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Collaboration Context
            </label>
            <Textarea
              value={collaborationContext}
              onChange={(e) => setCollaborationContext(e.target.value)}
              placeholder="Describe the purpose of this collaboration..."
              className="mt-1"
              rows={3}
            />
          </div>
          <Button 
            onClick={handleStartCollaboration}
            disabled={!newCollaboratorId.trim()}
            className="w-full"
          >
            Start Collaboration
          </Button>
        </CardContent>
      </Card>

      {/* Collaborations List */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Active ({activeCollaborations.length})
          </TabsTrigger>
          <TabsTrigger value="ended">
            Ended ({endedCollaborations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeCollaborations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active collaborations
            </div>
          ) : (
            <div className="space-y-3">
              {activeCollaborations.map((collaboration: any) => (
                <Card 
                  key={collaboration.id}
                  className={`cursor-pointer transition-colors ${
                    selectedCollaboration === collaboration.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedCollaboration(collaboration.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Users className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">
                            Collaboration {collaboration.id.slice(-8)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {collaboration.collaborators.length} participants
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getCollaborationStatus(collaboration)}
                        <p className="text-sm text-gray-500 mt-1">
                          {formatTime(collaboration.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ended" className="space-y-4">
          {endedCollaborations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No ended collaborations
            </div>
          ) : (
            <div className="space-y-3">
              {endedCollaborations.map((collaboration: any) => (
                <Card 
                  key={collaboration.id}
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedCollaboration(collaboration.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Users className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            Collaboration {collaboration.id.slice(-8)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {collaboration.collaborators.length} participants
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getCollaborationStatus(collaboration)}
                        <p className="text-sm text-gray-500 mt-1">
                          Ended: {collaboration.endedAt ? formatTime(collaboration.endedAt) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Selected Collaboration Details */}
      {selectedCollaborationData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Collaboration {selectedCollaborationData.id.slice(-8)}</span>
              </div>
              <div className="flex items-center space-x-2">
                {selectedCollaborationData.status === 'active' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleEndCollaboration(selectedCollaborationData.id)}
                  >
                    End Collaboration
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCollaboration(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Participants */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Participants</p>
              <div className="flex flex-wrap gap-2">
                {selectedCollaborationData.collaborators.map((collaboratorId: string) => (
                  <div key={collaboratorId} className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {collaboratorId === agentId ? 'ME' : collaboratorId.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {collaboratorId === agentId ? `${agentName} (You)` : collaboratorId}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Context */}
            {selectedCollaborationData.context && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Context</p>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  {selectedCollaborationData.context.purpose || 'No context provided'}
                </div>
              </div>
            )}

            {/* Messages */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Messages</p>
              <ScrollArea className="h-64 border rounded p-3">
                {selectedCollaborationData.messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No messages yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCollaborationData.messages.map((message: any, index: number) => (
                      <div
                        key={index}
                        className={`flex items-start space-x-3 ${
                          message.from === agentId ? 'flex-row-reverse space-x-reverse' : ''
                        }`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {message.from === agentId ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex-1 ${message.from === agentId ? 'text-right' : ''}`}>
                          <div className={`inline-block p-3 rounded-lg max-w-xs ${
                            message.from === agentId
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            <p className="text-sm">{message.message}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(message.timestamp)} • {message.from === agentId ? 'You' : message.from}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Message Input */}
            {selectedCollaborationData.status === 'active' && (
              <div className="flex space-x-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}