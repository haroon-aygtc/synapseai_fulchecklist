import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { usePermissions } from '@/lib/auth/permissions';
import { toast } from '@/components/ui/use-toast';
// Production API service integration - no more mock data
import agentApiService, { 
  Agent, 
  AgentTemplate, 
  CreateAgentRequest, 
  UpdateAgentRequest 
} from '@/lib/services/agent-api-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Bot, 
  Plus, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Copy, 
  Eye, 
  MessageSquare, 
  Clock, 
  Users, 
  Settings,
  MoreHorizontal,
  Upload,
  Share2,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wrench,
  Workflow,
  Globe,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// All types now imported from API service

const AGENT_TYPES = [
  { value: 'standalone', label: 'Standalone', icon: Bot },
  { value: 'tool-driven', label: 'Tool-Driven', icon: Wrench },
  { value: 'hybrid', label: 'Hybrid', icon: Workflow },
  { value: 'multi-task', label: 'Multi-Task', icon: TrendingUp },
  { value: 'multi-provider', label: 'Multi-Provider', icon: Globe }
];

export default function AgentManagement() {
  const { user, organization } = useAuth();
  const { hasPermission } = usePermissions();
  
  // State management - real data only
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load agents and templates on component mount
  useEffect(() => {
    if (organization?.id) {
      loadAgentsAndTemplates();
    }
  }, [organization?.id]);

  const loadAgentsAndTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [agentsResponse, templatesResponse] = await Promise.all([
        agentApiService.getAgents({
          organizationId: organization?.id || '',
          includeUsage: true,
          includePerformance: true,
          limit: 100,
          sortBy: 'lastActive',
          sortOrder: 'desc'
        }),
        agentApiService.getTemplates()
      ]);
      
      setAgents(agentsResponse.agents);
      setTemplates(templatesResponse.templates);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load agents and templates';
      setError(errorMessage);
      toast({
        title: 'Loading Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Real agent operations using API service
  const handleCreateAgent = async (agentData: CreateAgentRequest) => {
    try {
      const newAgent = await agentApiService.createAgent(agentData);
      setAgents(prev => [newAgent, ...prev]);
      setShowCreateDialog(false);
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleUpdateAgent = async (agentId: string, updates: UpdateAgentRequest) => {
    try {
      const updatedAgent = await agentApiService.updateAgent(agentId, updates);
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? updatedAgent : agent
      ));
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(updatedAgent);
      }
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await agentApiService.deleteAgent(agentId);
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleCreateFromTemplate = async (templateId: string, customizations: Partial<CreateAgentRequest>) => {
    try {
      const newAgent = await agentApiService.createFromTemplate(templateId, customizations);
      setAgents(prev => [newAgent, ...prev]);
      setShowTemplateDialog(false);
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleTestAgent = async (agentId: string, testInput: string) => {
    try {
      const execution = await agentApiService.testAgent(agentId, testInput);
      toast({
        title: 'Agent Test Started',
        description: `Test execution ${execution.id} has been started.`
      });
      return execution;
    } catch (error) {
      // Error handling is done in the service
      throw error;
    }
  };

  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    type: 'standalone' as Agent['type'],
    model: 'gpt-4',
    provider: 'OpenAI',
    capabilities: [] as string[],
    tags: [] as string[]
  });

  // UI Helper functions
  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'draft':
        return <Edit className="h-4 w-4 text-gray-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Agent['status']) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      error: 'destructive',
      draft: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getTypeColor = (type: Agent['type']) => {
    const colors = {
      standalone: 'bg-blue-500',
      'tool-driven': 'bg-yellow-500',
      hybrid: 'bg-purple-500',
      'multi-task': 'bg-green-500',
      'multi-provider': 'bg-indigo-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const resetForm = () => {
    setNewAgent({
      name: '',
      description: '',
      type: 'standalone',
      model: 'gpt-4',
      provider: 'OpenAI',
      capabilities: [],
      tags: []
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500';
      case 'INACTIVE': return 'bg-yellow-500';
      case 'ERROR': return 'bg-red-500';
      case 'EXPIRED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = AGENT_TYPES.find((t: any) => t.value === type);
    return typeConfig?.icon || Bot;
  };

  // Render agent card
  const renderAgentCard = (agent: Agent) => {
    const TypeIcon = getTypeIcon(agent.type);
    return (
      <Card key={agent.id} className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  <TypeIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  {getStatusIcon(agent.status)}
                  {getStatusBadge(agent.status)}
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedAgent(agent)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleTestAgent(agent.id, 'Test message')}
                  className="text-blue-600"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline" className={cn("text-xs", getTypeColor(agent.type))}>
              {agent.type.replace('-', ' ')}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Model:</span>
            <span className="font-medium">{agent.model}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Success Rate:</span>
              <span className="font-medium">{agent.successRate}%</span>
            </div>
            <Progress value={agent.successRate} className="h-1" />
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="font-medium">{agent.conversations}</div>
              <div className="text-muted-foreground text-xs">Conversations</div>
            </div>
            <div>
              <div className="font-medium">{agent.avgResponseTime}s</div>
              <div className="text-muted-foreground text-xs">Avg Response</div>
            </div>
            <div>
              <div className="font-medium">${agent.cost}</div>
              <div className="text-muted-foreground text-xs">Monthly Cost</div>
            </div>
          </div>
          
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
        </CardContent>
      </Card>
    );
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    const matchesType = typeFilter === 'all' || agent.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Error loading agents</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={loadAgentsAndTemplates} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground">Create, manage, and monitor your AI agents</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            From Template
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {AGENT_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No agents found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Get started by creating your first agent'}
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      ) : (
        <div className={cn(
          "grid gap-6",
          viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredAgents.map(renderAgentCard)}
        </div>
      )}

      {/* Create Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure your AI agent with the desired capabilities and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter agent name"
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={newAgent.type} onValueChange={(value) => setNewAgent(prev => ({ ...prev, type: value as Agent['type'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newAgent.description}
                onChange={(e) => setNewAgent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this agent does..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={newAgent.model}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="e.g., gpt-4"
                />
              </div>
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={newAgent.provider}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, provider: e.target.value }))}
                  placeholder="e.g., OpenAI"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleCreateAgent({
                name: newAgent.name,
                description: newAgent.description,
                type: newAgent.type,
                model: newAgent.model,
                provider: newAgent.provider,
                tags: newAgent.tags
              })} 
              disabled={!newAgent.name || !newAgent.description}
            >
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Details Sheet */}
      {selectedAgent && (
        <Sheet open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
          <SheetContent className="w-96">
            <SheetHeader>
              <SheetTitle>{selectedAgent.name}</SheetTitle>
              <SheetDescription>
                Detailed view of agent configuration and performance
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-full mt-6">
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Overview</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      {getStatusBadge(selectedAgent.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>{selectedAgent.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model:</span>
                      <span>{selectedAgent.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider:</span>
                      <span>{selectedAgent.provider}</span>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Performance</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success Rate:</span>
                      <span>{selectedAgent.successRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Response:</span>
                      <span>{selectedAgent.avgResponseTime}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conversations:</span>
                      <span>{selectedAgent.conversations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Cost:</span>
                      <span>${selectedAgent.cost}</span>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgent.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}