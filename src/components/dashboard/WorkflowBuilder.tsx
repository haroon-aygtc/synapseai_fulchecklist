"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Workflow,
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
  Activity,
  Clock,
  Zap,
  BarChart3,
  Grid3X3,
  List,
  Star,
  Users,
  Calendar,
  TrendingUp,
  Bot,
  Wrench,
  GitBranch,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  Download,
  Upload,
  Eye,
  Code,
  Layers
} from 'lucide-react';

interface WorkflowBuilderProps {
  className?: string;
}

const workflowTemplates = [
  {
    id: 'customer-support',
    name: 'Customer Support Flow',
    description: 'Automated customer inquiry handling with escalation',
    category: 'Support',
    nodes: 5,
    complexity: 'Simple',
    color: 'bg-blue-500'
  },
  {
    id: 'data-processing',
    name: 'Data Processing Pipeline',
    description: 'Extract, transform, and load data workflows',
    category: 'Data',
    nodes: 8,
    complexity: 'Medium',
    color: 'bg-green-500'
  },
  {
    id: 'content-generation',
    name: 'Content Generation Flow',
    description: 'Multi-step content creation and optimization',
    category: 'Content',
    nodes: 6,
    complexity: 'Simple',
    color: 'bg-purple-500'
  },
  {
    id: 'sales-automation',
    name: 'Sales Automation',
    description: 'Lead qualification and follow-up automation',
    category: 'Sales',
    nodes: 12,
    complexity: 'Complex',
    color: 'bg-orange-500'
  }
];

const workflows = [
  {
    id: 1,
    name: 'Customer Onboarding Flow',
    description: 'Automated customer onboarding with document processing',
    status: 'active',
    category: 'Support',
    nodes: 8,
    executions: 1247,
    successRate: 98.5,
    avgDuration: '2.3m',
    lastRun: '5 minutes ago',
    created: '2024-01-15',
    author: 'John Doe',
    favorite: true,
    tags: ['onboarding', 'automation', 'documents']
  },
  {
    id: 2,
    name: 'Lead Scoring Pipeline',
    description: 'Intelligent lead scoring with multiple data sources',
    status: 'active',
    category: 'Sales',
    nodes: 12,
    executions: 892,
    successRate: 96.2,
    avgDuration: '1.8m',
    lastRun: '12 minutes ago',
    created: '2024-01-10',
    author: 'Jane Smith',
    favorite: false,
    tags: ['sales', 'scoring', 'crm']
  },
  {
    id: 3,
    name: 'Content Moderation System',
    description: 'AI-powered content review and moderation',
    status: 'paused',
    category: 'Content',
    nodes: 6,
    executions: 634,
    successRate: 99.1,
    avgDuration: '0.8m',
    lastRun: '2 hours ago',
    created: '2024-01-08',
    author: 'Mike Johnson',
    favorite: true,
    tags: ['content', 'moderation', 'ai']
  },
  {
    id: 4,
    name: 'Invoice Processing Flow',
    description: 'Automated invoice extraction and validation',
    status: 'active',
    category: 'Finance',
    nodes: 10,
    executions: 423,
    successRate: 94.8,
    avgDuration: '3.1m',
    lastRun: '25 minutes ago',
    created: '2024-01-05',
    author: 'Sarah Wilson',
    favorite: false,
    tags: ['finance', 'invoices', 'ocr']
  },
  {
    id: 5,
    name: 'Social Media Monitor',
    description: 'Real-time social media monitoring and response',
    status: 'inactive',
    category: 'Marketing',
    nodes: 7,
    executions: 156,
    successRate: 97.3,
    avgDuration: '1.2m',
    lastRun: '3 days ago',
    created: '2024-01-03',
    author: 'Tom Brown',
    favorite: false,
    tags: ['social', 'monitoring', 'marketing']
  }
];

export default function WorkflowBuilder({ className }: WorkflowBuilderProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const categories = ['all', 'Support', 'Sales', 'Content', 'Data', 'Finance', 'Marketing'];

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || workflow.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || workflow.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'inactive': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'paused': return AlertCircle;
      case 'inactive': return XCircle;
      default: return XCircle;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Simple': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Complex': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`space-y-6 p-6 bg-background ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Builder</h1>
          <p className="text-muted-foreground">
            Design and orchestrate complex AI workflows with visual tools
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Create New Workflow</DialogTitle>
                <DialogDescription>
                  Start with a template or create a workflow from scratch.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="templates" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="scratch">From Scratch</TabsTrigger>
                </TabsList>
                <TabsContent value="templates" className="space-y-4">
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {workflowTemplates.map((template) => (
                      <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${template.color} flex items-center justify-center`}>
                              <Workflow className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{template.name}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{template.category}</Badge>
                                  <Badge className={getComplexityColor(template.complexity)}>
                                    {template.complexity}
                                  </Badge>
                                </div>
                              </div>
                              <CardDescription className="mt-1">{template.description}</CardDescription>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Layers className="h-3 w-3" />
                                  {template.nodes} nodes
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="scratch" className="space-y-4">
                  <div className="text-center py-8">
                    <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Start from Scratch</h3>
                    <p className="text-muted-foreground mb-4">
                      Create a custom workflow using our visual workflow builder
                    </p>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Open Workflow Builder
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create Workflow</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Category: {selectedCategory === 'all' ? 'All' : selectedCategory}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {categories.map((category) => (
              <DropdownMenuItem key={category} onClick={() => setSelectedCategory(category)}>
                {category === 'all' ? 'All Categories' : category}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Status: {selectedStatus === 'all' ? 'All' : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSelectedStatus('all')}>
              All Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedStatus('active')}>
              Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedStatus('paused')}>
              Paused
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedStatus('inactive')}>
              Inactive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-1 border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
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

      {/* Workflows Display */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Workflows ({filteredWorkflows.length})</TabsTrigger>
          <TabsTrigger value="favorites">Favorites ({filteredWorkflows.filter(w => w.favorite).length})</TabsTrigger>
          <TabsTrigger value="active">Active ({filteredWorkflows.filter(w => w.status === 'active').length})</TabsTrigger>
          <TabsTrigger value="recent">Recently Modified</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredWorkflows.map((workflow) => {
                const StatusIcon = getStatusIcon(workflow.status);
                return (
                  <Card key={workflow.id} className="bg-card hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Workflow className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{workflow.name}</CardTitle>
                              {workflow.favorite && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <StatusIcon className={`h-3 w-3 ${
                                workflow.status === 'active' ? 'text-green-600' :
                                workflow.status === 'paused' ? 'text-yellow-600' :
                                'text-gray-600'
                              }`} />
                              <span className="text-xs text-muted-foreground capitalize">{workflow.status}</span>
                              <Badge variant="outline" className="text-xs">
                                {workflow.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Clone
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>
                      
                      <div className="flex flex-wrap gap-1">
                        {workflow.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Activity className="h-3 w-3" />
                            Executions
                          </div>
                          <div className="font-medium">{workflow.executions.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            Success Rate
                          </div>
                          <div className="font-medium">{workflow.successRate}%</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Timer className="h-3 w-3" />
                            Avg Duration
                          </div>
                          <div className="font-medium">{workflow.avgDuration}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Layers className="h-3 w-3" />
                            Nodes
                          </div>
                          <div className="font-medium">{workflow.nodes}</div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <div>Created by {workflow.author}</div>
                        <div>Last run: {workflow.lastRun}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          {workflow.status === 'active' ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="outline" size="sm">
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card">
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredWorkflows.map((workflow) => {
                    const StatusIcon = getStatusIcon(workflow.status);
                    return (
                      <div key={workflow.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Workflow className="h-5 w-5 text-primary" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{workflow.name}</h3>
                            {workflow.favorite && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                            <StatusIcon className={`h-3 w-3 ${
                              workflow.status === 'active' ? 'text-green-600' :
                              workflow.status === 'paused' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`} />
                            <Badge variant="outline" className="text-xs">
                              {workflow.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{workflow.description}</p>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created by {workflow.author} • Last run: {workflow.lastRun}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <div className="font-medium">{workflow.executions.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">Executions</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{workflow.successRate}%</div>
                            <div className="text-xs text-muted-foreground">Success</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{workflow.avgDuration}</div>
                            <div className="text-xs text-muted-foreground">Duration</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{workflow.nodes}</div>
                            <div className="text-xs text-muted-foreground">Nodes</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="mr-2 h-4 w-4" />
                                Clone
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Export
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="favorites">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkflows.filter(workflow => workflow.favorite).map((workflow) => (
              <Card key={workflow.id} className="bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {workflow.name}
                  </CardTitle>
                  <CardDescription>{workflow.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkflows.filter(workflow => workflow.status === 'active').map((workflow) => (
              <Card key={workflow.id} className="bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {workflow.name}
                  </CardTitle>
                  <CardDescription>{workflow.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recent">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle>Recently Modified Workflows</CardTitle>
              <CardDescription>Workflows that have been updated recently</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredWorkflows.slice(0, 5).map((workflow) => (
                  <div key={workflow.id} className="flex items-center gap-4 p-3 rounded-lg border">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Workflow className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-sm text-muted-foreground">Modified {workflow.lastRun}</p>
                    </div>
                    <Button size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}