import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Zap, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Play,
  Pause,
  Settings,
  Copy,
  Trash2,
  Edit,
  Eye,
  Code,
  Database,
  Globe,
  MessageSquare,
  FileText,
  Image,
  Video,
  Music,
  Mail,
  Calendar,
  Calculator,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Users,
  BarChart3,
  Download,
  Upload,
  Wrench,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  Key,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tool {
  id: string;
  name: string;
  description: string;
  type: 'function' | 'api' | 'rag' | 'browser' | 'database' | 'webhook' | 'custom';
  category: string;
  status: 'active' | 'inactive' | 'error' | 'testing';
  version: string;
  author: string;
  usage: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  performance: {
    successRate: number;
    avgResponseTime: number;
    errorRate: number;
  };
  lastUsed: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  dependencies: string[];
  authentication: 'none' | 'api-key' | 'oauth' | 'basic' | 'custom';
  cost: number;
  rating: number;
  installs: number;
  icon?: string;
  config: Record<string, any>;
}

interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: Tool['type'];
  tags: string[];
  popularity: number;
  rating: number;
  installs: number;
  author: string;
  preview: string;
}

const toolCategories = [
  'Communication',
  'Data Processing',
  'File Management',
  'Web Scraping',
  'Database',
  'API Integration',
  'Analytics',
  'Security',
  'Automation',
  'AI/ML',
  'Utilities'
];

const toolTypes = {
  function: { icon: Code, color: 'bg-blue-500', label: 'Function' },
  api: { icon: Globe, color: 'bg-green-500', label: 'API Call' },
  rag: { icon: Database, color: 'bg-purple-500', label: 'RAG Retrieval' },
  browser: { icon: Globe, color: 'bg-orange-500', label: 'Browser Automation' },
  database: { icon: Database, color: 'bg-teal-500', label: 'Database Query' },
  webhook: { icon: Zap, color: 'bg-yellow-500', label: 'Webhook' },
  custom: { icon: Wrench, color: 'bg-gray-500', label: 'Custom' }
};

const mockTools: Tool[] = [
  {
    id: '1',
    name: 'Email Sender',
    description: 'Send emails with attachments and templates using SMTP or email service APIs',
    type: 'api',
    category: 'Communication',
    status: 'active',
    version: '2.1.0',
    author: 'SynapseAI Team',
    usage: { today: 45, week: 312, month: 1247, total: 5892 },
    performance: { successRate: 98.5, avgResponseTime: 1.2, errorRate: 1.5 },
    lastUsed: '5 minutes ago',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-20',
    tags: ['email', 'communication', 'smtp', 'templates'],
    dependencies: ['nodemailer', 'handlebars'],
    authentication: 'api-key',
    cost: 12.50,
    rating: 4.8,
    installs: 2847,
    config: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      templates: ['welcome', 'notification', 'alert']
    }
  },
  {
    id: '2',
    name: 'Data Processor',
    description: 'Process and transform data with built-in validation and cleaning capabilities',
    type: 'function',
    category: 'Data Processing',
    status: 'active',
    version: '1.5.2',
    author: 'John Doe',
    usage: { today: 23, week: 156, month: 678, total: 3421 },
    performance: { successRate: 96.2, avgResponseTime: 2.8, errorRate: 3.8 },
    lastUsed: '12 minutes ago',
    createdAt: '2024-01-08',
    updatedAt: '2024-01-18',
    tags: ['data', 'processing', 'validation', 'cleaning'],
    dependencies: ['pandas', 'numpy'],
    authentication: 'none',
    cost: 8.75,
    rating: 4.6,
    installs: 1923,
    config: {
      supportedFormats: ['csv', 'json', 'xml'],
      validationRules: ['required', 'email', 'phone', 'date']
    }
  },
  {
    id: '3',
    name: 'Web Scraper',
    description: 'Extract data from websites with anti-bot protection and proxy support',
    type: 'browser',
    category: 'Web Scraping',
    status: 'inactive',
    version: '3.0.1',
    author: 'Jane Smith',
    usage: { today: 0, week: 45, month: 234, total: 1567 },
    performance: { successRate: 89.3, avgResponseTime: 5.2, errorRate: 10.7 },
    lastUsed: '2 hours ago',
    createdAt: '2024-01-05',
    updatedAt: '2024-01-15',
    tags: ['scraping', 'web', 'automation', 'proxy'],
    dependencies: ['puppeteer', 'cheerio'],
    authentication: 'custom',
    cost: 15.30,
    rating: 4.3,
    installs: 1456,
    config: {
      userAgent: 'Mozilla/5.0...',
      timeout: 30000,
      retries: 3
    }
  }
];

const mockTemplates: ToolTemplate[] = [
  {
    id: 't1',
    name: 'Slack Notifier',
    description: 'Send notifications to Slack channels with rich formatting and attachments',
    category: 'Communication',
    type: 'api',
    tags: ['slack', 'notifications', 'webhooks'],
    popularity: 95,
    rating: 4.9,
    installs: 3421,
    author: 'SynapseAI',
    preview: 'async function sendSlackMessage(channel, message) { ... }'
  },
  {
    id: 't2',
    name: 'PDF Generator',
    description: 'Generate PDF documents from HTML templates with custom styling',
    category: 'File Management',
    type: 'function',
    tags: ['pdf', 'documents', 'templates'],
    popularity: 87,
    rating: 4.7,
    installs: 2156,
    author: 'Community',
    preview: 'function generatePDF(template, data) { ... }'
  }
];

export default function ToolManagement() {
  const [tools, setTools] = useState<Tool[]>(mockTools);
  const [templates, setTemplates] = useState<ToolTemplate[]>(mockTemplates);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);

  const [newTool, setNewTool] = useState({
    name: '',
    description: '',
    type: 'function' as Tool['type'],
    category: 'Utilities',
    authentication: 'none' as Tool['authentication'],
    tags: [] as string[],
    config: {}
  });

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || tool.category === categoryFilter;
    const matchesType = typeFilter === 'all' || tool.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || tool.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const getStatusIcon = (status: Tool['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'testing':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Tool['status']) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      error: 'destructive',
      testing: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getTypeColor = (type: Tool['type']) => {
    const colors = {
      function: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      api: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      rag: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      browser: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      database: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
      webhook: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      custom: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    };
    return colors[type];
  };

  const getAuthIcon = (auth: Tool['authentication']) => {
    switch (auth) {
      case 'api-key':
        return <Key className="h-3 w-3" />;
      case 'oauth':
        return <Shield className="h-3 w-3" />;
      case 'basic':
        return <Lock className="h-3 w-3" />;
      case 'custom':
        return <Settings className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const handleCreateTool = () => {
    const tool: Tool = {
      id: Date.now().toString(),
      ...newTool,
      status: 'testing',
      version: '1.0.0',
      author: 'Current User',
      usage: { today: 0, week: 0, month: 0, total: 0 },
      performance: { successRate: 0, avgResponseTime: 0, errorRate: 0 },
      lastUsed: 'Never',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      dependencies: [],
      cost: 0,
      rating: 0,
      installs: 0
    };
    
    setTools([...tools, tool]);
    setShowCreateDialog(false);
    setNewTool({
      name: '',
      description: '',
      type: 'function',
      category: 'Utilities',
      authentication: 'none',
      tags: [],
      config: {}
    });
  };

  const handleToggleTool = (toolId: string) => {
    setTools(tools.map(tool => 
      tool.id === toolId 
        ? { ...tool, status: tool.status === 'active' ? 'inactive' : 'active' }
        : tool
    ));
  };

  const handleDeleteTool = (toolId: string) => {
    setTools(tools.filter(tool => tool.id !== toolId));
  };

  const handleTestTool = (tool: Tool) => {
    setSelectedTool(tool);
    setShowTestDialog(true);
  };

  const ToolCard = ({ tool }: { tool: Tool }) => {
    const typeConfig = toolTypes[tool.type];
    const TypeIcon = typeConfig.icon;

    return (
      <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn("p-2 rounded-lg", typeConfig.color)}>
                <TypeIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">{tool.name}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  {getStatusIcon(tool.status)}
                  {getStatusBadge(tool.status)}
                  <Badge variant="outline" className="text-xs">
                    v{tool.version}
                  </Badge>
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
                <DropdownMenuItem onClick={() => setSelectedTool(tool)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTestTool(tool)}>
                  <Play className="h-4 w-4 mr-2" />
                  Test Tool
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
                  onClick={() => handleToggleTool(tool.id)}
                  className={tool.status === 'active' ? 'text-orange-600' : 'text-green-600'}
                >
                  {tool.status === 'active' ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteTool(tool.id)}
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
            {tool.description}
          </p>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Category:</span>
            <Badge variant="outline" className="text-xs">
              {tool.category}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline" className={cn("text-xs", getTypeColor(tool.type))}>
              {typeConfig.label}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Auth:</span>
            <div className="flex items-center space-x-1">
              {getAuthIcon(tool.authentication)}
              <span className="text-xs capitalize">{tool.authentication.replace('-', ' ')}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Success Rate:</span>
              <span className="font-medium">{tool.performance.successRate}%</span>
            </div>
            <Progress value={tool.performance.successRate} className="h-1" />
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="font-medium">{tool.usage.month}</div>
              <div className="text-muted-foreground text-xs">Monthly</div>
            </div>
            <div>
              <div className="font-medium">{tool.performance.avgResponseTime}s</div>
              <div className="text-muted-foreground text-xs">Avg Time</div>
            </div>
            <div>
              <div className="font-medium">${tool.cost}</div>
              <div className="text-muted-foreground text-xs">Cost</div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {tool.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tool.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{tool.tags.length - 3}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last used {tool.lastUsed}</span>
            <span>by {tool.author}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tool Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and integrate tools for your AI workflows
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
            <Download className="h-4 w-4 mr-2" />
            Browse Marketplace
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tool
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {toolCategories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(toolTypes).map(([type, config]) => (
              <SelectItem key={type} value={type}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {/* Tools Grid */}
      <div className={cn(
        "grid gap-6",
        viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
      )}>
        {filteredTools.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No tools found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || categoryFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Get started by creating your first tool'
            }
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tool
          </Button>
        </div>
      )}

      {/* Create Tool Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Tool</DialogTitle>
            <DialogDescription>
              Build a custom tool to extend your AI workflow capabilities
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tool-name">Tool Name</Label>
                <Input
                  id="tool-name"
                  value={newTool.name}
                  onChange={(e) => setNewTool({...newTool, name: e.target.value})}
                  placeholder="Enter tool name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tool-type">Tool Type</Label>
                <Select value={newTool.type} onValueChange={(value: Tool['type']) => setNewTool({...newTool, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(toolTypes).map(([type, config]) => (
                      <SelectItem key={type} value={type}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool-description">Description</Label>
              <Textarea
                id="tool-description"
                value={newTool.description}
                onChange={(e) => setNewTool({...newTool, description: e.target.value})}
                placeholder="Describe what this tool does"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tool-category">Category</Label>
                <Select value={newTool.category} onValueChange={(value) => setNewTool({...newTool, category: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toolCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tool-auth">Authentication</Label>
                <Select value={newTool.authentication} onValueChange={(value: Tool['authentication']) => setNewTool({...newTool, authentication: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="api-key">API Key</SelectItem>
                    <SelectItem value="oauth">OAuth</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTool} disabled={!newTool.name || !newTool.description}>
              Create Tool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tool Marketplace Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tool Marketplace</DialogTitle>
            <DialogDescription>
              Discover and install pre-built tools from the community
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
                    <span>Type: {toolTypes[template.type].label}</span>
                    <span>By: {template.author}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono mb-3">
                    {template.preview}
                  </div>
                  <Button className="w-full" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Install Tool
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tool Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Tool: {selectedTool?.name}</DialogTitle>
            <DialogDescription>
              Test your tool with sample inputs to verify functionality
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-input">Test Input</Label>
              <Textarea
                id="test-input"
                placeholder="Enter test data or parameters..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Output</Label>
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
                Test output will appear here...
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Cancel
            </Button>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Run Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tool Details Dialog */}
      {selectedTool && !showTestDialog && (
        <Dialog open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <div className={cn("p-2 rounded-lg", toolTypes[selectedTool.type].color)}>
                  {React.createElement(toolTypes[selectedTool.type].icon, { className: "h-5 w-5 text-white" })}
                </div>
                <span>{selectedTool.name}</span>
                {getStatusBadge(selectedTool.status)}
              </DialogTitle>
              <DialogDescription>
                {selectedTool.description}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Tool Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <Badge variant="outline" className={getTypeColor(selectedTool.type)}>
                          {toolTypes[selectedTool.type].label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category:</span>
                        <span>{selectedTool.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version:</span>
                        <span>v{selectedTool.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Author:</span>
                        <span>{selectedTool.author}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Authentication:</span>
                        <div className="flex items-center space-x-1">
                          {getAuthIcon(selectedTool.authentication)}
                          <span className="capitalize">{selectedTool.authentication.replace('-', ' ')}</span>
                        </div>
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
                        <span>{selectedTool.usage.today} calls</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">This Week:</span>
                        <span>{selectedTool.usage.week} calls</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">This Month:</span>
                        <span>{selectedTool.usage.month} calls</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span>{selectedTool.usage.total} calls</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly Cost:</span>
                        <span>${selectedTool.cost}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tags & Dependencies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Tags</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedTool.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Dependencies</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedTool.dependencies.map(dep => (
                          <Badge key={dep} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
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
                      <div className="text-2xl font-bold">{selectedTool.performance.successRate}%</div>
                      <Progress value={selectedTool.performance.successRate} className="mt-2" />
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
                      <div className="text-2xl font-bold">{selectedTool.performance.avgResponseTime}s</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Target: &lt;3s
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-red-500" />
                        Error Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedTool.performance.errorRate}%</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Target: &lt;5%
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="config" className="space-y-4">
                <div className="text-center text-muted-foreground py-8">
                  Tool configuration settings would go here
                </div>
              </TabsContent>
              
              <TabsContent value="usage" className="space-y-4">
                <div className="text-center text-muted-foreground py-8">
                  Detailed usage analytics and logs would go here
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}