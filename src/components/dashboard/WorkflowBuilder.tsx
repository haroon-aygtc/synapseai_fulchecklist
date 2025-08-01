import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Workflow, 
  Plus, 
  Play, 
  Pause, 
  Save, 
  Settings,
  Copy,
  Trash2,
  Edit,
  Eye,
  MoreHorizontal,
  Bot,
  Zap,
  Database,
  Globe,
  MessageSquare,
  Code,
  GitBranch,
  ArrowRight,
  ArrowDown,
  Circle,
  Square,
  Diamond,
  Triangle,
  Hexagon,
  MousePointer,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid,
  Layers,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { usePermissions } from '@/lib/auth/permissions';
import { toast } from '@/components/ui/use-toast';

// Production API service integration - no more mock data
import workflowApiService, { 
  WorkflowData as ApiWorkflowData, 
  CreateWorkflowRequest, 
  UpdateWorkflowRequest,
  WorkflowExecution,
  WorkflowNode as ApiWorkflowNode
} from '@/lib/services/workflow-api-service';

// Local interfaces for compatibility with existing UI
interface WorkflowNode {
  id: string;
  type: 'start' | 'agent' | 'tool' | 'condition' | 'loop' | 'end' | 'webhook' | 'api' | 'database';
  name: string;
  description?: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  inputs: string[];
  outputs: string[];
  status?: 'idle' | 'running' | 'success' | 'error';
}

interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  status: 'draft' | 'active' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  executions: number;
  successRate: number;
  avgExecutionTime: number;
  tags: string[];
}

const nodeTypes = {
  start: { icon: Play, color: 'bg-green-500', label: 'Start' },
  agent: { icon: Bot, color: 'bg-blue-500', label: 'Agent' },
  tool: { icon: Zap, color: 'bg-yellow-500', label: 'Tool' },
  condition: { icon: GitBranch, color: 'bg-purple-500', label: 'Condition' },
  loop: { icon: RotateCcw, color: 'bg-orange-500', label: 'Loop' },
  end: { icon: Circle, color: 'bg-red-500', label: 'End' },
  webhook: { icon: Globe, color: 'bg-indigo-500', label: 'Webhook' },
  api: { icon: Code, color: 'bg-pink-500', label: 'API Call' },
  database: { icon: Database, color: 'bg-teal-500', label: 'Database' }
};

// Production API service integration - no more mock data

export default function WorkflowBuilder() {
  const { user, organization } = useAuth();
  const { hasPermission } = usePermissions();
  
  // State management - real data only
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [isBuilderMode, setIsBuilderMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workflows on component mount and organization change
  useEffect(() => {
    if (organization?.id) {
      loadWorkflows();
    }
  }, [organization?.id]);

  // Helper function to convert API workflow to local interface
  const convertApiWorkflowToLocal = (apiWorkflow: ApiWorkflowData): WorkflowData => {
    return {
      id: apiWorkflow.id,
      name: apiWorkflow.name,
      description: apiWorkflow.description,
      nodes: apiWorkflow.nodes.map(node => ({
        id: node.id,
        type: node.type as WorkflowNode['type'],
        name: node.name,
        position: node.position,
        data: node.data,
        inputs: node.inputs,
        outputs: node.outputs
      })),
      connections: apiWorkflow.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label
      })),
      status: apiWorkflow.status as WorkflowData['status'],
      createdAt: apiWorkflow.createdAt,
      updatedAt: apiWorkflow.updatedAt,
      createdBy: apiWorkflow.createdBy,
      executions: apiWorkflow.usage.executions,
      successRate: apiWorkflow.usage.successRate,
      avgExecutionTime: apiWorkflow.usage.avgDuration,
      tags: apiWorkflow.tags
    };
  };

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await workflowApiService.getWorkflows({
        organizationId: organization?.id || '',
        includeNodes: true,
        includeExecutions: true,
        limit: 100,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      });
      
      const localWorkflows = response.workflows.map(convertApiWorkflowToLocal);
      setWorkflows(localWorkflows);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflows';
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

  // Real workflow operations
  const handleCreateWorkflow = async (workflowData: CreateWorkflowRequest) => {
    try {
      const apiWorkflow = await workflowApiService.createWorkflow(workflowData);
      const localWorkflow = convertApiWorkflowToLocal(apiWorkflow);
      setWorkflows(prev => [localWorkflow, ...prev]);
      setShowCreateDialog(false);
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleUpdateWorkflow = async (workflowId: string, updates: UpdateWorkflowRequest) => {
    try {
      const apiWorkflow = await workflowApiService.updateWorkflow(workflowId, updates);
      const localWorkflow = convertApiWorkflowToLocal(apiWorkflow);
      setWorkflows(prev => prev.map(workflow => 
        workflow.id === workflowId ? localWorkflow : workflow
      ));
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(localWorkflow);
      }
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      await workflowApiService.deleteWorkflow(workflowId);
      setWorkflows(prev => prev.filter(workflow => workflow.id !== workflowId));
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null);
        setIsBuilderMode(false);
      }
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleExecuteWorkflow = async (workflowId: string, input?: Record<string, any>) => {
    try {
      const execution = await workflowApiService.executeWorkflow(workflowId, {
        input: input || {},
        triggeredBy: user?.id || 'unknown',
        priority: 'normal'
      });
      
      toast({
        title: 'Workflow Execution Started',
        description: `Execution ${execution.id} is now running.`
      });
      
      return execution;
    } catch (error) {
      // Error handling is done in the service
      throw error;
    }
  };

  const handleDuplicateWorkflow = async (workflowId: string) => {
    try {
      const apiWorkflow = await workflowApiService.duplicateWorkflow(workflowId);
      const localWorkflow = convertApiWorkflowToLocal(apiWorkflow);
      setWorkflows(prev => [localWorkflow, ...prev]);
    } catch (error) {
      // Error handling is done in the service
    }
  };
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    tags: [] as string[]
  });

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: WorkflowData['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'draft':
        return <Edit className="h-4 w-4 text-gray-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: WorkflowData['status']) => {
    const variants = {
      active: 'default',
      paused: 'secondary',
      error: 'destructive',
      draft: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  const handleCreateWorkflowLocal = () => {
    const workflow: WorkflowData = {
      id: Date.now().toString(),
      ...newWorkflow,
      nodes: [
        {
          id: 'start-' + Date.now(),
          type: 'start',
          name: 'Start',
          position: { x: 100, y: 100 },
          data: {},
          inputs: [],
          outputs: ['output-1']
        }
      ],
      connections: [],
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      createdBy: 'Current User',
      executions: 0,
      successRate: 0,
      avgExecutionTime: 0
    };
    
    setWorkflows([...workflows, workflow]);
    setSelectedWorkflow(workflow);
    setIsBuilderMode(true);
    setShowCreateDialog(false);
    setNewWorkflow({ name: '', description: '', tags: [] });
  };

  const handleNodeDragStart = (nodeType: string) => {
    setDraggedNodeType(nodeType);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeType || !selectedWorkflow) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
    const y = (e.clientY - rect.top - canvasOffset.y) / canvasScale;

    const newNode: WorkflowNode = {
      id: `${draggedNodeType}-${Date.now()}`,
      type: draggedNodeType as WorkflowNode['type'],
      name: nodeTypes[draggedNodeType as keyof typeof nodeTypes].label,
      position: { x, y },
      data: {},
      inputs: draggedNodeType === 'start' ? [] : ['input-1'],
      outputs: draggedNodeType === 'end' ? [] : ['output-1']
    };

    setSelectedWorkflow({
      ...selectedWorkflow,
      nodes: [...selectedWorkflow.nodes, newNode]
    });

    setDraggedNodeType(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setCanvasOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleZoomIn = () => {
    setCanvasScale(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setCanvasScale(prev => Math.max(prev / 1.2, 0.3));
  };

  const handleResetView = () => {
    setCanvasOffset({ x: 0, y: 0 });
    setCanvasScale(1);
  };

  const NodeComponent = ({ node }: { node: WorkflowNode }) => {
    const nodeConfig = nodeTypes[node.type];
    const Icon = nodeConfig.icon;

    return (
      <div
        className={cn(
          "absolute bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-lg cursor-pointer transition-all hover:shadow-xl",
          selectedNode?.id === node.id && "border-blue-500 shadow-blue-200"
        )}
        style={{
          left: node.position.x,
          top: node.position.y,
          transform: `scale(${canvasScale})`
        }}
        onClick={() => setSelectedNode(node)}
      >
        <div className="p-3 min-w-[120px]">
          <div className="flex items-center space-x-2 mb-2">
            <div className={cn("p-1 rounded", nodeConfig.color)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium">{node.name}</span>
          </div>
          {node.description && (
            <p className="text-xs text-muted-foreground">{node.description}</p>
          )}
          {node.status && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {node.status}
              </Badge>
            </div>
          )}
        </div>
        
        {/* Input handles */}
        {node.inputs.map((input, index) => (
          <div
            key={input}
            className="absolute w-3 h-3 bg-blue-500 rounded-full -left-1.5 border-2 border-white"
            style={{ top: `${20 + index * 20}px` }}
          />
        ))}
        
        {/* Output handles */}
        {node.outputs.map((output, index) => (
          <div
            key={output}
            className="absolute w-3 h-3 bg-green-500 rounded-full -right-1.5 border-2 border-white"
            style={{ top: `${20 + index * 20}px` }}
          />
        ))}
      </div>
    );
  };

  const WorkflowCard = ({ workflow }: { workflow: WorkflowData }) => (
    <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{workflow.name}</CardTitle>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusIcon(workflow.status)}
              {getStatusBadge(workflow.status)}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setSelectedWorkflow(workflow);
                setIsBuilderMode(true);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Workflow
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Play className="h-4 w-4 mr-2" />
                Run Workflow
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {workflow.description}
        </p>
        
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="font-medium">{workflow.executions}</div>
            <div className="text-muted-foreground text-xs">Executions</div>
          </div>
          <div>
            <div className="font-medium">{workflow.successRate}%</div>
            <div className="text-muted-foreground text-xs">Success Rate</div>
          </div>
          <div>
            <div className="font-medium">{workflow.avgExecutionTime}s</div>
            <div className="text-muted-foreground text-xs">Avg Time</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress:</span>
            <span className="font-medium">{workflow.successRate}%</span>
          </div>
          <Progress value={workflow.successRate} className="h-1" />
        </div>
        
        <div className="flex flex-wrap gap-1">
          {workflow.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {workflow.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{workflow.tags.length - 3}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Updated {workflow.updatedAt}</span>
          <span>by {workflow.createdBy}</span>
        </div>
      </CardContent>
    </Card>
  );

  if (isBuilderMode && selectedWorkflow) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Builder Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setIsBuilderMode(false)}
            >
              ← Back to Workflows
            </Button>
            <div>
              <h1 className="text-xl font-bold">{selectedWorkflow.name}</h1>
              <p className="text-sm text-muted-foreground">Workflow Builder</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleResetView}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset View
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button size="sm">
              <Play className="h-4 w-4 mr-2" />
              Run
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Node Palette */}
          <div className="w-64 border-r bg-card p-4">
            <h3 className="font-medium mb-4">Node Types</h3>
            <div className="space-y-2">
              {Object.entries(nodeTypes).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <div
                    key={type}
                    className="flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-accent transition-colors"
                    draggable
                    onDragStart={() => handleNodeDragStart(type)}
                  >
                    <div className={cn("p-1 rounded", config.color)}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm">{config.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <div
              ref={canvasRef}
              className="w-full h-full bg-gray-50 dark:bg-gray-900 relative cursor-move"
              onDrop={handleCanvasDrop}
              onDragOver={(e) => e.preventDefault()}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{
                backgroundImage: `radial-gradient(circle, #ccc 1px, transparent 1px)`,
                backgroundSize: `${20 * canvasScale}px ${20 * canvasScale}px`,
                backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`
              }}
            >
              <div
                style={{
                  transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`
                }}
              >
                {selectedWorkflow.nodes.map(node => (
                  <NodeComponent key={node.id} node={node} />
                ))}
                
                {/* Connections */}
                <svg className="absolute inset-0 pointer-events-none">
                  {selectedWorkflow.connections.map(connection => {
                    const sourceNode = selectedWorkflow.nodes.find(n => n.id === connection.source);
                    const targetNode = selectedWorkflow.nodes.find(n => n.id === connection.target);
                    
                    if (!sourceNode || !targetNode) return null;
                    
                    const startX = (sourceNode.position.x + 120) * canvasScale;
                    const startY = (sourceNode.position.y + 30) * canvasScale;
                    const endX = targetNode.position.x * canvasScale;
                    const endY = (targetNode.position.y + 30) * canvasScale;
                    
                    return (
                      <line
                        key={connection.id}
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#3b82f6"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill="#3b82f6"
                      />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </div>

          {/* Properties Panel */}
          {selectedNode && (
            <div className="w-80 border-l bg-card p-4">
              <h3 className="font-medium mb-4">Node Properties</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="node-name">Name</Label>
                  <Input
                    id="node-name"
                    value={selectedNode.name}
                    onChange={(e) => {
                      const updatedNodes = selectedWorkflow.nodes.map(node =>
                        node.id === selectedNode.id
                          ? { ...node, name: e.target.value }
                          : node
                      );
                      setSelectedWorkflow({
                        ...selectedWorkflow,
                        nodes: updatedNodes
                      });
                      setSelectedNode({ ...selectedNode, name: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="node-description">Description</Label>
                  <Textarea
                    id="node-description"
                    value={selectedNode.description || ''}
                    onChange={(e) => {
                      const updatedNodes = selectedWorkflow.nodes.map(node =>
                        node.id === selectedNode.id
                          ? { ...node, description: e.target.value }
                          : node
                      );
                      setSelectedWorkflow({
                        ...selectedWorkflow,
                        nodes: updatedNodes
                      });
                      setSelectedNode({ ...selectedNode, description: e.target.value });
                    }}
                    rows={3}
                  />
                </div>
                {selectedNode.type === 'agent' && (
                  <div>
                    <Label htmlFor="agent-select">Select Agent</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support-bot">Customer Support Bot</SelectItem>
                        <SelectItem value="data-agent">Data Analysis Agent</SelectItem>
                        <SelectItem value="content-creator">Content Creator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedNode.type === 'tool' && (
                  <div>
                    <Label htmlFor="tool-select">Select Tool</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a tool" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email-sender">Email Sender</SelectItem>
                        <SelectItem value="data-processor">Data Processor</SelectItem>
                        <SelectItem value="api-caller">API Caller</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const updatedNodes = selectedWorkflow.nodes.filter(node => node.id !== selectedNode.id);
                    setSelectedWorkflow({
                      ...selectedWorkflow,
                      nodes: updatedNodes
                    });
                    setSelectedNode(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Node
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Management</h1>
          <p className="text-muted-foreground">
            Design and manage your AI workflow orchestrations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Workflow className="h-4 w-4 mr-2" />
            Browse Templates
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Workflows Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredWorkflows.map(workflow => (
          <WorkflowCard key={workflow.id} workflow={workflow} />
        ))}
      </div>

      {filteredWorkflows.length === 0 && (
        <div className="text-center py-12">
          <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No workflows found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Get started by creating your first workflow'
            }
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      )}

      {/* Create Workflow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Set up a new workflow to orchestrate your AI agents and tools
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({...newWorkflow, name: e.target.value})}
                placeholder="Enter workflow name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow({...newWorkflow, description: e.target.value})}
                placeholder="Describe what this workflow does"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleCreateWorkflow({
                name: newWorkflow.name,
                description: newWorkflow.description,
                tags: newWorkflow.tags,
                nodes: [],
                edges: [],
                triggers: [],
                settings: {
                  timeout: 300000,
                  retryPolicy: {
                    maxRetries: 3,
                    backoffStrategy: 'exponential'
                  },
                  errorHandling: 'stop'
                }
              })} 
              disabled={!newWorkflow.name || !newWorkflow.description}
            >
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}