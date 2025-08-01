import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Connection,
  ConnectionMode,
  Panel,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  Square, 
  Save, 
  Download, 
  Upload, 
  Settings, 
  Plus, 
  Trash2, 
  Copy,
  Eye,
  EyeOff,
  Zap,
  Bot,
  Wrench,
  GitBranch,
  RotateCcw,
  Users,
  Clock,
  Webhook,
  Calendar
} from 'lucide-react';

import { useWorkflow, useUpdateWorkflow, useExecuteWorkflow } from '@/lib/sdk/hooks';
import { WorkflowNode, WorkflowEdge, Workflow, WorkflowExecution } from '@/lib/sdk/types';
import { cn } from '@/lib/utils';

// Custom Node Types
const AgentNode = ({ data, selected }: { data: any; selected: boolean }) => (
  <div className={cn(
    "px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[150px]",
    selected ? "border-blue-500" : "border-gray-200",
    "hover:shadow-lg transition-shadow"
  )}>
    <div className="flex items-center gap-2">
      <Bot className="w-4 h-4 text-blue-600" />
      <div className="font-medium text-sm">{data.label}</div>
    </div>
    <div className="text-xs text-gray-500 mt-1">{data.config?.model || 'GPT-4'}</div>
    {data.status && (
      <Badge variant={data.status === 'running' ? 'default' : 'secondary'} className="mt-1 text-xs">
        {data.status}
      </Badge>
    )}
  </div>
);

const ToolNode = ({ data, selected }: { data: any; selected: boolean }) => (
  <div className={cn(
    "px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[150px]",
    selected ? "border-green-500" : "border-gray-200",
    "hover:shadow-lg transition-shadow"
  )}>
    <div className="flex items-center gap-2">
      <Wrench className="w-4 h-4 text-green-600" />
      <div className="font-medium text-sm">{data.label}</div>
    </div>
    <div className="text-xs text-gray-500 mt-1">{data.config?.type || 'API'}</div>
    {data.status && (
      <Badge variant={data.status === 'running' ? 'default' : 'secondary'} className="mt-1 text-xs">
        {data.status}
      </Badge>
    )}
  </div>
);

const HybridNode = ({ data, selected }: { data: any; selected: boolean }) => (
  <div className={cn(
    "px-4 py-2 shadow-md rounded-md bg-gradient-to-r from-blue-50 to-green-50 border-2 min-w-[150px]",
    selected ? "border-purple-500" : "border-gray-200",
    "hover:shadow-lg transition-shadow"
  )}>
    <div className="flex items-center gap-2">
      <Zap className="w-4 h-4 text-purple-600" />
      <div className="font-medium text-sm">{data.label}</div>
    </div>
    <div className="text-xs text-gray-500 mt-1">Agent + Tool</div>
    {data.status && (
      <Badge variant={data.status === 'running' ? 'default' : 'secondary'} className="mt-1 text-xs">
        {data.status}
      </Badge>
    )}
  </div>
);

const ConditionNode = ({ data, selected }: { data: any; selected: boolean }) => (
  <div className={cn(
    "px-4 py-2 shadow-md rounded-md bg-yellow-50 border-2 min-w-[150px]",
    selected ? "border-yellow-500" : "border-gray-200",
    "hover:shadow-lg transition-shadow"
  )}>
    <div className="flex items-center gap-2">
      <GitBranch className="w-4 h-4 text-yellow-600" />
      <div className="font-medium text-sm">{data.label}</div>
    </div>
    <div className="text-xs text-gray-500 mt-1">Conditional</div>
  </div>
);

const HumanApprovalNode = ({ data, selected }: { data: any; selected: boolean }) => (
  <div className={cn(
    "px-4 py-2 shadow-md rounded-md bg-orange-50 border-2 min-w-[150px]",
    selected ? "border-orange-500" : "border-gray-200",
    "hover:shadow-lg transition-shadow"
  )}>
    <div className="flex items-center gap-2">
      <Users className="w-4 h-4 text-orange-600" />
      <div className="font-medium text-sm">{data.label}</div>
    </div>
    <div className="text-xs text-gray-500 mt-1">Human Approval</div>
    {data.status === 'waiting' && (
      <Badge variant="outline" className="mt-1 text-xs border-orange-500 text-orange-600">
        Waiting
      </Badge>
    )}
  </div>
);

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  hybrid: HybridNode,
  condition: ConditionNode,
  'human-approval': HumanApprovalNode
};

interface WorkflowBuilderProps {
  workflowId?: string;
  onSave?: (workflow: Workflow) => void;
  onExecute?: (execution: WorkflowExecution) => void;
  readOnly?: boolean;
  className?: string;
}

const WorkflowBuilderContent: React.FC<WorkflowBuilderProps> = ({
  workflowId,
  onSave,
  onExecute,
  readOnly = false,
  className
}) => {
  const { data: workflowData } = useWorkflow(workflowId || '');
  const updateWorkflowMutation = useUpdateWorkflow();
  const executeWorkflowMutation = useExecuteWorkflow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const reactFlowInstance = useReactFlow();

  // Load workflow data
  useEffect(() => {
    if (workflowData?.data) {
      const workflow = workflowData.data;
      setNodes(workflow.nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      })));
      setEdges(workflow.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'default',
        data: edge.data
      })));
    }
  }, [workflowData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (readOnly) return;
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges, readOnly]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addNode = useCallback((type: string) => {
    if (readOnly) return;
    
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        config: {},
        inputs: [],
        outputs: []
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, readOnly]);

  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly) return;
    
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges, readOnly]);

  const duplicateNode = useCallback((node: Node) => {
    if (readOnly) return;
    
    const newNode: Node = {
      ...node,
      id: `${node.type}-${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      },
      data: {
        ...node.data,
        label: `${node.data.label} (Copy)`
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, readOnly]);

  const saveWorkflow = useCallback(async () => {
    if (!workflowId || readOnly) return;
    
    const workflowNodes: WorkflowNode[] = nodes.map(node => ({
      id: node.id,
      type: node.type as any,
      position: node.position,
      data: node.data
    }));
    
    const workflowEdges: WorkflowEdge[] = edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type as any,
      data: edge.data
    }));

    try {
      const result = await updateWorkflowMutation.mutateAsync({
        id: workflowId,
        updates: {
          nodes: workflowNodes,
          edges: workflowEdges
        }
      });
      
      if (onSave && result.data) {
        onSave(result.data);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  }, [workflowId, nodes, edges, updateWorkflowMutation, onSave, readOnly]);

  const executeWorkflow = useCallback(async () => {
    if (!workflowId || readOnly) return;
    
    setIsExecuting(true);
    setExecutionLogs([]);
    
    try {
      const result = await executeWorkflowMutation.mutateAsync({
        id: workflowId,
        input: {}
      });
      
      if (onExecute && result.data) {
        onExecute(result.data);
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [workflowId, executeWorkflowMutation, onExecute, readOnly]);

  const exportWorkflow = useCallback(() => {
    const workflow = {
      nodes,
      edges,
      viewport: reactFlowInstance.getViewport()
    };
    
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `workflow-${workflowId || 'untitled'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [nodes, edges, reactFlowInstance, workflowId]);

  const importWorkflow = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target?.result as string);
        setNodes(workflow.nodes || []);
        setEdges(workflow.edges || []);
        if (workflow.viewport) {
          reactFlowInstance.setViewport(workflow.viewport);
        }
      } catch (error) {
        console.error('Failed to import workflow:', error);
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges, reactFlowInstance, readOnly]);

  const nodeToolbar = useMemo(() => {
    if (!selectedNode || readOnly) return null;
    
    return (
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border p-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => duplicateNode(selectedNode)}
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => deleteNode(selectedNode.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  }, [selectedNode, duplicateNode, deleteNode, readOnly]);

  return (
    <div className={cn("h-full w-full bg-gray-50", className)}>
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Workflow Builder</h2>
            {workflowData?.data && (
              <Badge variant="outline">{workflowData.data.name}</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addNode('agent')}
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Agent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addNode('tool')}
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Tool
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addNode('hybrid')}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Hybrid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addNode('condition')}
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  Condition
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addNode('human-approval')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Human
                </Button>
                <Separator orientation="vertical" className="h-6" />
              </>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMiniMap(!showMiniMap)}
            >
              {showMiniMap ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={exportWorkflow}
            >
              <Download className="w-4 h-4" />
            </Button>
            
            {!readOnly && (
              <>
                <input
                  type="file"
                  accept=".json"
                  onChange={importWorkflow}
                  className="hidden"
                  id="import-workflow"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById('import-workflow')?.click()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  onClick={saveWorkflow}
                  disabled={updateWorkflowMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </>
            )}
            
            <Button
              size="sm"
              onClick={executeWorkflow}
              disabled={isExecuting || executeWorkflowMutation.isPending}
            >
              {isExecuting ? (
                <Pause className="w-4 h-4 mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isExecuting ? 'Running' : 'Execute'}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Canvas */}
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              className="bg-gray-50"
            >
              <Controls />
              {showMiniMap && (
                <MiniMap
                  nodeColor={(node) => {
                    switch (node.type) {
                      case 'agent': return '#3b82f6';
                      case 'tool': return '#10b981';
                      case 'hybrid': return '#8b5cf6';
                      case 'condition': return '#f59e0b';
                      case 'human-approval': return '#f97316';
                      default: return '#6b7280';
                    }
                  }}
                />
              )}
              <Background variant="dots" gap={12} size={1} />
              
              {/* Node Toolbar */}
              {nodeToolbar}
            </ReactFlow>
          </div>

          {/* Side Panel */}
          {selectedNode && (
            <div className="w-80 bg-white border-l">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Node Configuration</h3>
                <p className="text-sm text-gray-500">{selectedNode.type} node</p>
              </div>
              
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="p-4 space-y-4">
                  <div>
                    <Label htmlFor="node-label">Label</Label>
                    <Input
                      id="node-label"
                      value={selectedNode.data.label}
                      onChange={(e) => {
                        if (readOnly) return;
                        setNodes((nds) =>
                          nds.map((n) =>
                            n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, label: e.target.value } }
                              : n
                          )
                        );
                      }}
                      disabled={readOnly}
                    />
                  </div>
                  
                  {selectedNode.type === 'agent' && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="agent-model">Model</Label>
                        <Select
                          value={selectedNode.data.config?.model || 'gpt-4'}
                          onValueChange={(value) => {
                            if (readOnly) return;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...n.data.config, model: value } } }
                                  : n
                              )
                            );
                          }}
                          disabled={readOnly}
                        >
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
                      
                      <div>
                        <Label htmlFor="agent-prompt">System Prompt</Label>
                        <Textarea
                          id="agent-prompt"
                          value={selectedNode.data.config?.systemPrompt || ''}
                          onChange={(e) => {
                            if (readOnly) return;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...n.data.config, systemPrompt: e.target.value } } }
                                  : n
                              )
                            );
                          }}
                          placeholder="Enter system prompt..."
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  )}
                  
                  {selectedNode.type === 'tool' && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="tool-type">Tool Type</Label>
                        <Select
                          value={selectedNode.data.config?.type || 'api'}
                          onValueChange={(value) => {
                            if (readOnly) return;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...n.data.config, type: value } } }
                                  : n
                              )
                            );
                          }}
                          disabled={readOnly}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="function">Function</SelectItem>
                            <SelectItem value="rag">RAG</SelectItem>
                            <SelectItem value="browser">Browser</SelectItem>
                            <SelectItem value="database">Database</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="tool-endpoint">Endpoint</Label>
                        <Input
                          id="tool-endpoint"
                          value={selectedNode.data.config?.endpoint || ''}
                          onChange={(e) => {
                            if (readOnly) return;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...n.data.config, endpoint: e.target.value } } }
                                  : n
                              )
                            );
                          }}
                          placeholder="https://api.example.com/endpoint"
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  )}
                  
                  {selectedNode.type === 'condition' && (
                    <div>
                      <Label htmlFor="condition-expression">Condition Expression</Label>
                      <Textarea
                        id="condition-expression"
                        value={selectedNode.data.config?.expression || ''}
                        onChange={(e) => {
                          if (readOnly) return;
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, data: { ...n.data, config: { ...n.data.config, expression: e.target.value } } }
                                : n
                            )
                          );
                        }}
                        placeholder="input.value > 100"
                        disabled={readOnly}
                      />
                    </div>
                  )}
                  
                  {selectedNode.type === 'human-approval' && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="approval-message">Approval Message</Label>
                        <Textarea
                          id="approval-message"
                          value={selectedNode.data.config?.message || ''}
                          onChange={(e) => {
                            if (readOnly) return;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...n.data.config, message: e.target.value } } }
                                  : n
                              )
                            );
                          }}
                          placeholder="Please review and approve..."
                          disabled={readOnly}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="approval-required"
                          checked={selectedNode.data.config?.required || false}
                          onCheckedChange={(checked) => {
                            if (readOnly) return;
                            setNodes((nds) =>
                              nds.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, data: { ...n.data, config: { ...n.data.config, required: checked } } }
                                  : n
                              )
                            );
                          }}
                          disabled={readOnly}
                        />
                        <Label htmlFor="approval-required">Required Approval</Label>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderContent {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowBuilder;