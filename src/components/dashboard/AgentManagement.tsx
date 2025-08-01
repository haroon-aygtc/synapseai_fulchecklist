import React, { useState, useEffect } from 'react';
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
import { useApix } from '@/lib/apix/hooks';
import { Permission } from '@/lib/auth/types';
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
import { toast } from '@/components/ui/use-toast';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Trash2, 
  Copy, 
  Edit, 
  Eye, 
  MessageSquare, 
  Activity, 
  Clock, 
  Users, 
  Zap,
  Brain,
  Bot,
  Sparkles,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  Upload,
  Share2,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  description: string;
  type: 'standalone' | 'tool-driven' | 'hybrid' | 'multi-task' | 'multi-provider';
  status: 'active' | 'inactive' | 'error' | 'training';
  model: string;
  provider: string;
  conversations: number;
  successRate: number;
  avgResponseTime: number;
  lastActive: string;
  createdAt: string;
  createdBy: string;
  tags: string[];
  capabilities: string[];
  avatar?: string;
  cost: number;
  usage: {
    today: number;
    week: number;
    month: number;
  };
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: Agent['type'];
  model: string;
  provider: string;
  tags: string[];
  popularity: number;
  rating: number;
  installs: number;
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Customer Support Bot',
    description: 'Handles customer inquiries and support tickets with advanced NLP capabilities',
    type: 'hybrid',
    status: 'active',
    model: 'gpt-4',
    provider: 'OpenAI',
    conversations: 1247,
    successRate: 94.2,
    avgResponseTime: 1.8,
    lastActive: '2 minutes ago',
    createdAt: '2024-01-15',
    createdBy: 'John Doe',
    tags: ['customer-service', 'nlp', 'multilingual'],
    capabilities: ['Text Analysis', 'Sentiment Detection', 'Multi-language', 'Context Memory'],
    cost: 247.50,
    usage: { today: 45, week: 312, month: 1247 }
  },
  {
    id: '2',
    name: 'Data Analysis Agent',
    description: 'Processes and analyzes large datasets with statistical insights',
    type: 'tool-driven',
    status: 'active',
    model: 'claude-3',
    provider: 'Anthropic',
    conversations: 89,
    successRate: 98.7,
    avgResponseTime: 3.2,
    lastActive: '15 minutes ago',
    createdAt: '2024-01-10',
    createdBy: 'Jane Smith',
    tags: ['analytics', 'data-science', 'statistics'],
    capabilities: ['Data Processing', 'Statistical Analysis', 'Visualization', 'Report Generation'],
    cost: 156.30,
    usage: { today: 12, week: 67, month: 289 }
  },
  {
    id: '3',
    name: 'Content Creator',
    description: 'Generates high-quality content for marketing and social media',
    type: 'standalone',
    status: 'inactive',
    model: 'gemini-pro',
    provider: 'Google',
    conversations: 456,
    successRate: 91.5,
    avgResponseTime: 2.1,
    lastActive: '2 hours ago',
    createdAt: '2024-01-08',
    createdBy: 'Mike Johnson',
    tags: ['content', 'marketing', 'creative'],
    capabilities: ['Content Generation', 'SEO Optimization', 'Brand Voice', 'Multi-format'],
    cost: 89.75,
    usage: { today: 0, week: 23, month: 456 }
  }
];

const mockTemplates: AgentTemplate[] = [
  {
    id: 't1',
    name: 'E-commerce Assistant',
    description: 'Complete e-commerce support with order tracking and product recommendations',
    category: 'Customer Service',
    type: 'hybrid',
    model: 'gpt-4',
    provider: 'OpenAI',
    tags: ['ecommerce', 'recommendations', 'orders'],
    popularity: 95,
    rating: 4.8,
    installs: 2847
  },
  {
    id: 't2',
    name: 'HR Recruitment Bot',
    description: 'Automates candidate screening and interview scheduling',
    category: 'Human Resources',
    type: 'tool-driven',
    model: 'claude-3',
    provider: 'Anthropic',
    tags: ['hr', 'recruitment', 'screening'],
    popularity: 87,
    rating: 4.6,
    installs: 1923
  }
];

export default function AgentManagement() {
  const { user, organization } = useAuth();
  const { hasPermission } = usePermissions();
  
  // State management
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [templates, setTemplates] = useState<AgentTemplate[]>(mockTemplates);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    type: 'standalone' as Agent['type'],
    model: 'gpt-4',
    provider: 'OpenAI',
    capabilities: [] as string[],
    tags: [] as string[]
  });

  const { client, isConnected } = useApix();

  // Data loading functions
  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch agents',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Real-time updates via APIX
  useEffect(() => {
    if (!client || !isConnected) return;

    const handleAgentEvent = (event: any) => {
      switch (event.type) {
        case 'AGENT_CREATED':
          setAgents(prev => [event.data, ...prev]);
          toast({
            title: 'Agent Created',
            description: `Agent "${event.data.name}" has been created`
          });
          break;

        case 'AGENT_UPDATED':
          setAgents(prev => prev.map(agent => 
            agent.id === event.data.id ? event.data : agent
          ));
          if (selectedAgent?.id === event.data.id) {
            setSelectedAgent(event.data);
          }
          break;

        case 'AGENT_DELETED':
          setAgents(prev => prev.filter(agent => agent.id !== event.agentId));
          if (selectedAgent?.id === event.agentId) {
            setSelectedAgent(null);
          }
          toast({
            title: 'Agent Deleted',
            description: 'Agent has been deleted'
          });
          break;

        case 'AGENT_RESPONSE':
          if (event.sessionId === currentSessionId) {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: event.response,
              timestamp: new Date().toISOString()
            }]);
            setChatLoading(false);
          }
          break;
      }
    };

    client.subscribe('agent-events', handleAgentEvent);

    return () => {
      client.unsubscribe('agent-events', handleAgentEvent);
    };
  }, [client, isConnected, selectedAgent, currentSessionId]);

  // Agent actions
  const handleCreateAgent = () => {
    const agent: Agent = {
      id: Date.now().toString(),
      ...newAgent,
      status: 'training',
      conversations: 0,
      successRate: 0,
      avgResponseTime: 0,
      lastActive: 'Never',
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: 'Current User',
      cost: 0,
      usage: { today: 0, week: 0, month: 0 }
    };
    
    setAgents([...agents, agent]);
    setShowCreateDialog(false);
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

  const handleToggleAgent = (agentId: string) => {
    setAgents(agents.map(agent => 
      agent.id === agentId 
        ? { ...agent, status: agent.status === 'active' ? 'inactive' : 'active' }
        : agent
    ));
  };

  const handleDeleteAgent = (agentId: string) => {
    setAgents(agents.filter(agent => agent.id !== agentId));
  };

  const AgentCard = ({ agent }: { agent: Agent }) => (
    <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={agent.avatar} />
              <AvatarFallback>
                <Bot className="h-5 w-5" />
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
                onClick={() => handleToggleAgent(agent.id)}
                className={agent.status === 'active' ? 'text-orange-600' : 'text-green-600'}
              >
                {agent.status === 'active' ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
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
              +{agent.tags.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'training':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Agent['status']) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      error: 'destructive',
      training: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getTypeColor = (type: Agent['type']) => {
    const colors = {
      standalone: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'tool-driven': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      hybrid: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'multi-task': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'multi-provider': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300'
    };
    return colors[type];
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

  // Filter and search logic
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    const matchesType = typeFilter === 'all' || agent.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500';
      case 'INACTIVE': return 'bg-gray-500';
      case 'EXPIRED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = AGENT_TYPES.find(t => t.value === type);
    return typeConfig?.icon || Bot;
  };

  // Render agent card
  const renderAgentCard = (agent: Agent) => {
    const TypeIcon = getTypeIcon(agent.type);
    return (
      <Card key={agent.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm group hover:scale-105">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
                <TypeIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {agent.name}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {agent.type.replace('_', ' ')}
                  </Badge>
                  <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setSelectedAgent(agent);
                  setIsChatOpen(true);
                  setChatMessages([]);
                  setCurrentSessionId(null);
                }}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedAgent(agent)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
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
        
        <CardContent className="pt-0">
          <CardDescription className="text-sm text-gray-600 mb-4 line-clamp-2">
            {agent.description || 'No description provided'}
          </CardDescription>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Model:</span>
              <Badge variant="outline">{agent.model}</Badge>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Active Sessions:</span>
              <span className="font-medium">{agent.sessions?.length || 0}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Version:</span>
              <span className="font-medium">v{agent.version}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Created:</span>
              <span className="font-medium">
                {new Date(agent.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              onClick={() => {
                setSelectedAgent(agent);
                setIsChatOpen(true);
                setChatMessages([]);
                setCurrentSessionId(null);
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSelectedAgent(agent)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedAgent || chatLoading) return;

    const userMessage = {
      role: 'user' as const,
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatLoading(true);
    setChatInput('');

    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: currentSessionId,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to execute agent');
      }

      const result: AgentExecution = await response.json();
      
      if (!currentSessionId) {
        setCurrentSessionId(result.sessionId);
      }

      if (result.response) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: result.response!,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white">
                <Bot className="h-8 w-8" />
              </div>
              Agent Management
            </h1>
            <p className="text-gray-600 mt-2">
              Create, manage, and interact with AI agents
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border shadow-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-48 border-gray-200">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {AGENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-gray-500">{type.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="px-3"
                >
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="px-3"
                >
                  List
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agents Grid/List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map(renderAgentCard)}
          </div>
        ) : (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {filteredAgents.map((agent) => {
                  const TypeIcon = getTypeIcon(agent.type);
                  return (
                    <div key={agent.id} className="p-6 hover:bg-gray-50/50 transition-colors group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
                            <TypeIcon className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {agent.name}
                              </h3>
                              <Badge variant="secondary" className="text-xs">
                                {agent.type.replace('_', ' ')}
                              </Badge>
                              <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {agent.description || 'No description provided'}
                            </p>
                            <div className="flex items-center gap-6 text-xs text-gray-500">
                              <span>Model: {agent.model}</span>
                              <span>Sessions: {agent.sessions?.length || 0}</span>
                              <span>Version: v{agent.version}</span>
                              <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            size="sm" 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                            onClick={() => {
                              setSelectedAgent(agent);
                              setIsChatOpen(true);
                              setChatMessages([]);
                              setCurrentSessionId(null);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedAgent(agent)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
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
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && filteredAgents.length === 0 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Bot className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No agents found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' 
                  ? 'Try adjusting your filters or search query'
                  : 'Get started by creating your first agent'
                }
              </p>
              {!searchQuery && statusFilter === 'all' && typeFilter === 'all' && (
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Agent
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure your new AI agent with the settings below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                  placeholder="Enter agent name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Agent Type</Label>
                <Select value={newAgent.type} onValueChange={(value: Agent['type']) => setNewAgent({...newAgent, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standalone">Standalone</SelectItem>
                    <SelectItem value="tool-driven">Tool-driven</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="multi-task">Multi-task</SelectItem>
                    <SelectItem value="multi-provider">Multi-provider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newAgent.description}
                onChange={(e) => setNewAgent({...newAgent, description: e.target.value})}
                placeholder="Describe what this agent does"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select value={newAgent.model} onValueChange={(value) => setNewAgent({...newAgent, model: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={newAgent.provider} onValueChange={(value) => setNewAgent({...newAgent, provider: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OpenAI">OpenAI</SelectItem>
                    <SelectItem value="Anthropic">Anthropic</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="Mistral">Mistral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAgent} disabled={!newAgent.name || !newAgent.description}>
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Browser Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Agent Templates</DialogTitle>
            <DialogDescription>
              Choose from pre-built agent templates to get started quickly
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map(template => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {template.category}
                      </Badge>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {template.rating}
                      </div>
                      <div>{template.installs} installs</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {template.description}
                  </p>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span>Model: {template.model}</span>
                    <span>Provider: {template.provider}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Button className="w-full" size="sm">
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Interface */}
      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col">
          <SheetHeader className="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <SheetTitle className="flex items-center gap-3 text-white">
              <MessageSquare className="h-5 w-5" />
              Chat with {selectedAgent?.name}
            </SheetTitle>
            <SheetDescription className="text-blue-100">
              Interact with your AI agent in real-time
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <MessageSquare className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600">Start a conversation with your agent</p>
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-600">Agent is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={chatLoading}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Agent Details Dialog */}
      {selectedAgent && (
        <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedAgent.avatar} />
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span>{selectedAgent.name}</span>
                {getStatusBadge(selectedAgent.status)}
              </DialogTitle>
              <DialogDescription>
                {selectedAgent.description}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <Badge variant="outline" className={getTypeColor(selectedAgent.type)}>
                          {selectedAgent.type}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model:</span>
                        <span>{selectedAgent.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provider:</span>
                        <span>{selectedAgent.provider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{selectedAgent.createdAt}</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Usage Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Today:</span>
                        <span>{selectedAgent.usage.today} requests</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">This Week:</span>
                        <span>{selectedAgent.usage.week} requests</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">This Month:</span>
                        <span>{selectedAgent.usage.month} requests</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly Cost:</span>
                        <span>${selectedAgent.cost}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Capabilities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedAgent.capabilities.map(capability => (
                        <Badge key={capability} variant="secondary">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        Success Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedAgent.successRate}%</div>
                      <Progress value={selectedAgent.successRate} className="mt-2" />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-blue-500" />
                        Avg Response Time
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedAgent.avgResponseTime}s</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Target: &lt;2s
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <MessageSquare className="h-4 w-4 mr-2 text-purple-500" />
                        Total Conversations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedAgent.conversations}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        All time
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="settings" className="space-y-4">
                <div className="text-center text-muted-foreground py-8">
                  Agent settings configuration would go here
                </div>
              </TabsContent>
              
              <TabsContent value="logs" className="space-y-4">
                <div className="text-center text-muted-foreground py-8">
                  Agent execution logs would go here
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}