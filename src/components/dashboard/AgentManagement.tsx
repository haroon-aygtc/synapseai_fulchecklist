'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Agent, 
  AgentType, 
  AgentStatus, 
  AgentSession, 
  AgentTask, 
  AgentTemplate,
  AgentAnalytics 
} from '@/lib/agents/types';
import { agentService } from '@/lib/agents/agent-service';
import { useAuth, usePermissions } from '@/lib/auth/auth-context';
import { apixClient } from '@/lib/apix/client';
import { Permission } from '@/lib/auth/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Copy, 
  Download, 
  Upload, 
  Trash2, 
  Edit, 
  Eye, 
  MessageSquare, 
  Activity, 
  BarChart3, 
  Users, 
  Clock, 
  Zap, 
  Brain, 
  Code, 
  Search,
  Filter,
  Grid,
  List,
  Plus,
  RefreshCw,
  Star,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentManagementProps {
  className?: string;
}

export default function AgentManagement({ className }: AgentManagementProps) {
  const { user, organization } = useAuth();
  const { hasPermission } = usePermissions();
  
  // State management
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeSessions, setActiveSessions] = useState<AgentSession[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [analytics, setAnalytics] = useState<AgentAnalytics[]>([]);
  
  // UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<AgentType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AgentStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);

  // Real-time updates
  useEffect(() => {
    if (!user || !organization) return;

    const subscribeToEvents = async () => {
      await apixClient.subscribe('agent-events', (event) => {
        switch (event.type) {
          case 'AGENT_CREATED':
            setAgents(prev => [...prev, event.data]);
            break;
          case 'AGENT_UPDATED':
            setAgents(prev => prev.map(agent => 
              agent.id === event.agentId ? { ...agent, ...event.data.updates } : agent
            ));
            break;
          case 'AGENT_DELETED':
            setAgents(prev => prev.filter(agent => agent.id !== event.agentId));
            break;
          case 'SESSION_STARTED':
            loadActiveSessions();
            break;
          case 'SESSION_STOPPED':
            loadActiveSessions();
            break;
          case 'TASK_STARTED':
          case 'TASK_COMPLETED':
          case 'TASK_FAILED':
            if (selectedAgent?.id === event.agentId) {
              loadAgentTasks(event.agentId);
            }
            break;
        }
      }, {
        organizationId: organization.id
      });
    };

    subscribeToEvents();
    loadAgents();
    loadTemplates();
    loadActiveSessions();

    return () => {
      // Cleanup subscriptions
    };
  }, [user, organization, selectedAgent]);

  // Data loading functions
  const loadAgents = useCallback(async () => {
    if (!hasPermission(Permission.AGENT_READ)) return;
    
    try {
      setIsLoading(true);
      // In a real implementation, this would fetch from API
      const mockAgents: Agent[] = [
        {
          id: 'agent_1',
          organizationId: organization?.id || '',
          createdBy: user?.id || '',
          configuration: {
            name: 'Customer Support Agent',
            description: 'Handles customer inquiries and support tickets',
            type: AgentType.TOOL_DRIVEN,
            model: 'gpt-4',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 2000,
            systemPrompt: 'You are a helpful customer support agent...',
            tools: ['knowledge_base', 'ticket_system'],
            skills: ['customer_service', 'problem_solving'],
            memorySettings: {
              enabled: true,
              maxSize: 10000,
              pruningStrategy: 'intelligent',
              persistentMemory: true
            },
            collaborationSettings: {
              allowAgentToAgent: true,
              maxCollaborators: 5,
              shareMemory: false
            },
            securitySettings: {
              allowedDomains: [],
              rateLimits: {
                requestsPerMinute: 60,
                requestsPerHour: 1000
              },
              dataRetention: 30
            }
          },
          version: '1.2.0',
          isActive: true,
          isPublic: false,
          tags: ['customer-service', 'support'],
          metadata: {},
          performance: {
            totalExecutions: 1250,
            successfulExecutions: 1180,
            failedExecutions: 70,
            averageResponseTime: 850,
            averageTokenUsage: 450,
            lastExecutionAt: new Date(),
            uptime: 99.2,
            errorRate: 0.056
          },
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date()
        },
        {
          id: 'agent_2',
          organizationId: organization?.id || '',
          createdBy: user?.id || '',
          configuration: {
            name: 'Data Analysis Agent',
            description: 'Analyzes data and generates insights',
            type: AgentType.HYBRID,
            model: 'gpt-4',
            provider: 'openai',
            temperature: 0.3,
            maxTokens: 4000,
            systemPrompt: 'You are a data analysis expert...',
            tools: ['data_processor', 'chart_generator', 'sql_executor'],
            skills: ['data_analysis', 'visualization', 'statistics'],
            memorySettings: {
              enabled: true,
              maxSize: 50000,
              pruningStrategy: 'lru',
              persistentMemory: true
            },
            collaborationSettings: {
              allowAgentToAgent: true,
              maxCollaborators: 3,
              shareMemory: true
            },
            securitySettings: {
              allowedDomains: ['*.company.com'],
              rateLimits: {
                requestsPerMinute: 30,
                requestsPerHour: 500
              },
              dataRetention: 90
            }
          },
          version: '2.1.0',
          isActive: true,
          isPublic: false,
          tags: ['data-analysis', 'insights', 'reporting'],
          metadata: {},
          performance: {
            totalExecutions: 890,
            successfulExecutions: 865,
            failedExecutions: 25,
            averageResponseTime: 1200,
            averageTokenUsage: 850,
            lastExecutionAt: new Date(),
            uptime: 98.8,
            errorRate: 0.028
          },
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date()
        }
      ];
      setAgents(mockAgents);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission, organization, user]);

  const loadTemplates = useCallback(async () => {
    try {
      const agentTemplates = await agentService.getAgentTemplates();
      setTemplates(agentTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }, []);

  const loadActiveSessions = useCallback(async () => {
    try {
      // Mock active sessions
      const mockSessions: AgentSession[] = [
        {
          id: 'session_1',
          agentId: 'agent_1',
          userId: user?.id || '',
          organizationId: organization?.id || '',
          status: AgentStatus.RUNNING,
          context: { customerTicket: '12345' },
          memory: {
            shortTerm: {},
            longTerm: {},
            episodic: [],
            semantic: {},
            working: {},
            metadata: { totalSize: 0, lastPruned: new Date(), version: 1 }
          },
          tasks: [],
          collaborators: [],
          startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          lastActivityAt: new Date()
        }
      ];
      setActiveSessions(mockSessions);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  }, [user, organization]);

  const loadAgentTasks = useCallback(async (agentId: string) => {
    try {
      // Mock tasks for the selected agent
      const mockTasks: AgentTask[] = [
        {
          id: 'task_1',
          sessionId: 'session_1',
          name: 'Process Customer Inquiry',
          description: 'Handle customer support ticket #12345',
          status: 'IN_PROGRESS' as any,
          priority: 1,
          input: { ticketId: '12345', customerMessage: 'Need help with billing' },
          progress: 75,
          dependencies: [],
          createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          startedAt: new Date(Date.now() - 8 * 60 * 1000)
        }
      ];
      setAgentTasks(mockTasks);
    } catch (error) {
      console.error('Error loading agent tasks:', error);
    }
  }, []);

  const loadAgentAnalytics = useCallback(async (agentId: string) => {
    try {
      const agentAnalytics = await agentService.getAgentAnalytics(agentId, 'day');
      setAnalytics(agentAnalytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }, []);

  // Agent actions
  const handleCreateAgent = async (template?: AgentTemplate) => {
    if (!hasPermission(Permission.AGENT_CREATE) || !user || !organization) return;

    try {
      setIsCreating(true);
      
      const configuration = template?.configuration || {
        name: 'New Agent',
        description: 'A new AI agent',
        type: AgentType.STANDALONE,
        model: 'gpt-4',
        provider: 'openai',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: 'You are a helpful AI assistant.',
        tools: [],
        skills: [],
        memorySettings: {
          enabled: true,
          maxSize: 10000,
          pruningStrategy: 'intelligent',
          persistentMemory: false
        },
        collaborationSettings: {
          allowAgentToAgent: false,
          maxCollaborators: 1,
          shareMemory: false
        },
        securitySettings: {
          allowedDomains: [],
          rateLimits: {
            requestsPerMinute: 60,
            requestsPerHour: 1000
          },
          dataRetention: 30
        }
      };

      const newAgent = await agentService.createAgent(
        organization.id,
        user.id,
        configuration,
        [Permission.AGENT_CREATE]
      );

      setAgents(prev => [...prev, newAgent]);
      setShowCreateDialog(false);
      setShowTemplateDialog(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error creating agent:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartSession = async (agent: Agent) => {
    if (!hasPermission(Permission.AGENT_EXECUTE) || !user) return;

    try {
      const session = await agentService.startAgentSession(
        agent.id,
        user.id,
        {},
        [Permission.AGENT_EXECUTE]
      );
      
      setActiveSessions(prev => [...prev, session]);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    if (!user) return;

    try {
      await agentService.stopAgentSession(sessionId, user.id);
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Error stopping session:', error);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!hasPermission(Permission.AGENT_DELETE) || !user) return;

    try {
      await agentService.deleteAgent(agentId, user.id, [Permission.AGENT_DELETE]);
      setAgents(prev => prev.filter(a => a.id !== agentId));
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
    }
  };

  // Filter and search logic
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.configuration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.configuration.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = filterType === 'all' || agent.configuration.type === filterType;
    
    const agentStatus = activeSessions.some(s => s.agentId === agent.id && s.status === AgentStatus.RUNNING) 
      ? AgentStatus.RUNNING 
      : AgentStatus.IDLE;
    const matchesStatus = filterStatus === 'all' || agentStatus === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Render agent card
  const renderAgentCard = (agent: Agent) => {
    const isRunning = activeSessions.some(s => s.agentId === agent.id && s.status === AgentStatus.RUNNING);
    const runningSession = activeSessions.find(s => s.agentId === agent.id && s.status === AgentStatus.RUNNING);

    return (
      <Card 
        key={agent.id} 
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-lg",
          selectedAgent?.id === agent.id && "ring-2 ring-primary"
        )}
        onClick={() => {
          setSelectedAgent(agent);
          loadAgentTasks(agent.id);
          loadAgentAnalytics(agent.id);
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                {agent.configuration.name}
                {isRunning && <Badge variant="default" className="bg-green-500"><Play className="w-3 h-3 mr-1" />Running</Badge>}
                {!agent.isActive && <Badge variant="secondary">Inactive</Badge>}
              </CardTitle>
              <CardDescription className="mt-1">
                {agent.configuration.description}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline">{agent.configuration.type}</Badge>
              {agent.isPublic && <Badge variant="secondary">Public</Badge>}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Performance metrics */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Executions:</span>
                <span className="font-medium">{agent.performance.totalExecutions}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Success Rate:</span>
                <span className="font-medium">
                  {((agent.performance.successfulExecutions / agent.performance.totalExecutions) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Avg Response:</span>
                <span className="font-medium">{agent.performance.averageResponseTime}ms</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Uptime:</span>
                <span className="font-medium">{agent.performance.uptime}%</span>
              </div>
            </div>

            {/* Running session info */}
            {runningSession && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Active Session</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Started {new Date(runningSession.startedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )}

            {/* Tags */}
            {agent.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {agent.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {agent.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{agent.tags.length - 3} more
                  </Badge>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {hasPermission(Permission.AGENT_EXECUTE) && (
                  <>
                    {!isRunning ? (
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartSession(agent);
                        }}
                        disabled={!agent.isActive}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (runningSession) {
                            handleStopSession(runningSession.id);
                          }
                        }}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Stop
                      </Button>
                    )}
                  </>
                )}
                
                {hasPermission(Permission.AGENT_UPDATE) && (
                  <Button size="sm" variant="outline">
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost">
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <BarChart3 className="w-4 h-4" />
                </Button>
                {hasPermission(Permission.AGENT_DELETE) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{agent.configuration.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground mt-1">
            Create, manage, and monitor your AI agents
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {hasPermission(Permission.AGENT_CREATE) && (
            <>
              <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    From Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Choose Agent Template</DialogTitle>
                    <DialogDescription>
                      Select a pre-built template to quickly create a new agent
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {templates.map(template => (
                      <Card 
                        key={template.id}
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:shadow-md",
                          selectedTemplate?.id === template.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{template.name}</CardTitle>
                              <CardDescription className="text-sm mt-1">
                                {template.description}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span className="text-sm">{template.rating}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{template.category}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {template.downloads} downloads
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => selectedTemplate && handleCreateAgent(selectedTemplate)}
                      disabled={!selectedTemplate || isCreating}
                    >
                      {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Agent
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={() => handleCreateAgent()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center gap-4 p-6 border-b bg-muted/30">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={filterType} onValueChange={(value) => setFilterType(value as AgentType | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value={AgentType.STANDALONE}>Standalone</SelectItem>
            <SelectItem value={AgentType.TOOL_DRIVEN}>Tool-Driven</SelectItem>
            <SelectItem value={AgentType.HYBRID}>Hybrid</SelectItem>
            <SelectItem value={AgentType.MULTI_TASK}>Multi-Task</SelectItem>
            <SelectItem value={AgentType.MULTI_PROVIDER}>Multi-Provider</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as AgentStatus | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value={AgentStatus.RUNNING}>Running</SelectItem>
            <SelectItem value={AgentStatus.IDLE}>Idle</SelectItem>
            <SelectItem value={AgentStatus.PAUSED}>Paused</SelectItem>
            <SelectItem value={AgentStatus.ERROR}>Error</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={loadAgents}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Agents List */}
        <div className="flex-1 p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Brain className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agents found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterType !== 'all' || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first agent to get started'
                }
              </p>
              {hasPermission(Permission.AGENT_CREATE) && !searchQuery && filterType === 'all' && filterStatus === 'all' && (
                <Button onClick={() => handleCreateAgent()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Agent
                </Button>
              )}
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                : "space-y-4"
            )}>
              {filteredAgents.map(renderAgentCard)}
            </div>
          )}
        </div>

        {/* Agent Details Panel */}
        {selectedAgent && (
          <div className="w-96 border-l bg-muted/30 flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedAgent.configuration.name}</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {selectedAgent.configuration.description}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Tabs defaultValue="overview" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4 mx-6 mt-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="overview" className="h-full p-6 overflow-y-auto">
                  <div className="space-y-6">
                    {/* Configuration */}
                    <div>
                      <h3 className="font-semibold mb-3">Configuration</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <Badge variant="outline">{selectedAgent.configuration.type}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Model:</span>
                          <span>{selectedAgent.configuration.model}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Provider:</span>
                          <span>{selectedAgent.configuration.provider}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Version:</span>
                          <span>{selectedAgent.version}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Performance */}
                    <div>
                      <h3 className="font-semibold mb-3">Performance</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Success Rate</span>
                            <span>{((selectedAgent.performance.successfulExecutions / selectedAgent.performance.totalExecutions) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress 
                            value={(selectedAgent.performance.successfulExecutions / selectedAgent.performance.totalExecutions) * 100} 
                            className="h-2"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Uptime</span>
                            <span>{selectedAgent.performance.uptime}%</span>
                          </div>
                          <Progress value={selectedAgent.performance.uptime} className="h-2" />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Tools & Skills */}
                    <div>
                      <h3 className="font-semibold mb-3">Tools & Skills</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-muted-foreground">Tools:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedAgent.configuration.tools.map(tool => (
                              <Badge key={tool} variant="secondary" className="text-xs">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Skills:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedAgent.configuration.skills.map(skill => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sessions" className="h-full p-6 overflow-y-auto">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Active Sessions</h3>
                    {activeSessions.filter(s => s.agentId === selectedAgent.id).length === 0 ? (
                      <p className="text-muted-foreground text-sm">No active sessions</p>
                    ) : (
                      activeSessions
                        .filter(s => s.agentId === selectedAgent.id)
                        .map(session => (
                          <Card key={session.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">Session {session.id.slice(-8)}</span>
                                <Badge variant={session.status === AgentStatus.RUNNING ? 'default' : 'secondary'}>
                                  {session.status}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Started: {session.startedAt.toLocaleString()}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Last Activity: {session.lastActivityAt.toLocaleString()}
                              </div>
                              {session.status === AgentStatus.RUNNING && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="mt-2"
                                  onClick={() => handleStopSession(session.id)}
                                >
                                  <Square className="w-4 h-4 mr-1" />
                                  Stop Session
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="h-full p-6 overflow-y-auto">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Recent Tasks</h3>
                    {agentTasks.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No recent tasks</p>
                    ) : (
                      agentTasks.map(task => (
                        <Card key={task.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{task.name}</span>
                              <Badge variant={
                                task.status === 'COMPLETED' ? 'default' :
                                task.status === 'FAILED' ? 'destructive' :
                                task.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                              }>
                                {task.status === 'IN_PROGRESS' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                {task.status === 'COMPLETED' && <CheckCircle className="w-3 h-3 mr-1" />}
                                {task.status === 'FAILED' && <XCircle className="w-3 h-3 mr-1" />}
                                {task.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {task.description}
                            </p>
                            {task.status === 'IN_PROGRESS' && (
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Progress</span>
                                  <span>{task.progress}%</span>
                                </div>
                                <Progress value={task.progress} className="h-2" />
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-2">
                              Created: {task.createdAt.toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="analytics" className="h-full p-6 overflow-y-auto">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Analytics</h3>
                    {analytics.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Loading analytics...</p>
                    ) : (
                      <div className="space-y-4">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold">
                                {analytics[analytics.length - 1]?.metrics.executions || 0}
                              </div>
                              <div className="text-sm text-muted-foreground">Executions Today</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold">
                                {((analytics[analytics.length - 1]?.metrics.successRate || 0) * 100).toFixed(1)}%
                              </div>
                              <div className="text-sm text-muted-foreground">Success Rate</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold">
                                {Math.round(analytics[analytics.length - 1]?.metrics.averageResponseTime || 0)}ms
                              </div>
                              <div className="text-sm text-muted-foreground">Avg Response</div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold">
                                {analytics[analytics.length - 1]?.metrics.userSatisfaction.toFixed(1) || 'N/A'}
                              </div>
                              <div className="text-sm text-muted-foreground">User Rating</div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}