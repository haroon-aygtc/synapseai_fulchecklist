import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  NodeToolbar,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  Save, 
  Download, 
  Upload, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  Bot,
  Zap,
  GitBranch,
  RotateCcw,
  User,
  Database,
  Globe,
  Code,
  Settings,
  Eye,
  Trash2,
  Copy,
  Edit,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';

import { WorkflowNode as WorkflowNodeType, WorkflowEdge, NodeType, EdgeType } from '@/lib/workflows/types';
import { cn } from '@/lib/utils';

// Custom Node Components
import AgentNode from './nodes/AgentNode';
import ToolNode from './nodes/ToolNode';
import HybridNode from './nodes/HybridNode';
import ConditionNode from './nodes/ConditionNode';
import LoopNode from './nodes/LoopNode';
import TriggerNode from './nodes/TriggerNode';
import HumanInputNode from './nodes/HumanInputNode';
import TransformerNode from './nodes/TransformerNode';

// Custom Edge Components
import CustomEdge from './edges/CustomEdge';

const nodeTypes: NodeTypes = {
  [NodeType.AGENT]: AgentNode,
  [NodeType.TOOL]: ToolNode,
  [NodeType.HYBRID]: HybridNode,
  [NodeType.CONDITION]: ConditionNode,
  [NodeType.LOOP]: LoopNode,
  [NodeType.TRIGGER]: TriggerNode,
  [NodeType.HUMAN_INPUT]: HumanInputNode,
  [NodeType.TRANSFORMER]: TransformerNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

interface NodePaletteItem {
  type: NodeType;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  category: 'core' | 'control' | 'integration' | 'custom';
}

const nodePalette: NodePaletteItem[] = [
  {
    type: NodeType.TRIGGER,
    label: 'Trigger',
    icon: Play,
    color: 'bg-green-500',
    description: 'Start workflow execution',
    category: 'core'
  },
  {
    type: NodeType.AGENT,
    label: 'Agent',
    icon: Bot,
    color: 'bg-blue-500',
    description: 'AI agent processing',
    category: 'core'
  },
  {
    type: NodeType.TOOL,
    label: 'Tool',
    icon: Zap,
    color: 'bg-yellow-500',
    description: 'External tool execution',
    category: 'core'
  },
  {
    type: NodeType.HYBRID,
    label: 'Hybrid',
    icon: Activity,
    color: 'bg-purple-500',
    description: 'Agent-tool hybrid processing',
    category: 'core'
  },
  {
    type: NodeType.CONDITION,
    label: 'Condition',
    icon: GitBranch,
    color: 'bg-orange-500',
    description: 'Conditional branching',
    category: 'control'
  },
  {
    type: NodeType.LOOP,
    label: 'Loop',
    icon: RotateCcw,
    color: 'bg-indigo-500',
    description: 'Iterative processing',
    category: 'control'
  },
  {
    type: NodeType.HUMAN_INPUT,
    label: 'Human Input',
    icon: User,
    color: 'bg-pink-500',
    description: 'Human-in-the-loop approval',
    category: 'control'
  },
  {
    type: NodeType.TRANSFORMER,
    label: 'Transformer',
    icon: Code,
    color: 'bg-teal-500',
    description: 'Data transformation',
    category: 'integration'
  },
];

interface WorkflowCanvasProps {
  workflow?: {
    id: string;
    name: string;
    nodes: WorkflowNodeType[];
    edges: WorkflowEdge[];
    status: string;
  };
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  onExecute?: () => void;
  onNodeSelect?: (node: Node | null) => void;
  isExecuting?: boolean;
  executionStatus?: Record<string, 'idle' | 'running' | 'success' | 'error'>;
  className?: string;
}

function WorkflowCanvasInner({
  workflow,
  onSave,
  onExecute,
  onNodeSelect,
  isExecuting = false,
  executionStatus = {},
  className = ''
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<NodeType | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { project, getViewport, setViewport, fitView } = useReactFlow();

  // Initialize workflow data
  useEffect(() => {
    if (workflow) {
      const flowNodes: Node[] = workflow.nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          ...node.data,
          label: node.label,
          status: executionStatus[node.id] || 'idle'
        },
        style: {
          ...node.style,
          border: executionStatus[node.id] === 'running' ? '2px solid #3b82f6' :
                  executionStatus[node.id] === 'success' ? '2px solid #10b981' :
                  executionStatus[node.id] === 'error' ? '2px solid #ef4444' : undefined
        }
      }));

      const flowEdges: Edge[] = workflow.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'custom',
        animated: edge.animated || false,
        style: edge.style,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#374151',
        },
        data: edge.data
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [workflow, executionStatus, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const edge: Edge = {
        ...params,
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        type: 'custom',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#374151',
        },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!draggedNodeType || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `${draggedNodeType}-${Date.now()}`,
        type: draggedNodeType,
        position,
        data: {
          nodeType: draggedNodeType,
          label: nodePalette.find(n => n.type === draggedNodeType)?.label || draggedNodeType,
          config: {},
          inputSchema: {},
          outputSchema: {},
          inputMappings: {},
          outputMappings: {},
          metadata: {},
          status: 'idle'
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setDraggedNodeType(null);
    },
    [draggedNodeType, project, setNodes]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const handleSave = useCallback(() => {
    onSave?.(nodes, edges);
  }, [nodes, edges, onSave]);

  const handleValidate = useCallback(async () => {
    setIsValidating(true);
    const errors: string[] = [];

    // Check for disconnected nodes
    const connectedNodeIds = new Set();
    edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const disconnectedNodes = nodes.filter(node => 
      node.type !== NodeType.TRIGGER && !connectedNodeIds.has(node.id)
    );

    if (disconnectedNodes.length > 0) {
      errors.push(`${disconnectedNodes.length} disconnected nodes found`);
    }

    // Check for cycles
    const hasCycle = detectCycle(nodes, edges);
    if (hasCycle) {
      errors.push('Workflow contains cycles');
    }

    // Check for missing trigger
    const triggerNodes = nodes.filter(node => node.type === NodeType.TRIGGER);
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    }

    setValidationErrors(errors);
    setIsValidating(false);
  }, [nodes, edges]);

  const detectCycle = (nodes: Node[], edges: Edge[]): boolean => {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recStack = new Set<string>();

    // Build adjacency list
    nodes.forEach(node => graph.set(node.id, []));
    edges.forEach(edge => {
      const neighbors = graph.get(edge.source) || [];
      neighbors.push(edge.target);
      graph.set(edge.source, neighbors);
    });

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  };

  const handleExport = useCallback(() => {
    const workflowData = {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        data: edge.data
      }))
    };

    const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${workflow?.name || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, workflow]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflowData = JSON.parse(e.target?.result as string);
        if (workflowData.nodes && workflowData.edges) {
          setNodes(workflowData.nodes);
          setEdges(workflowData.edges);
        }
      } catch (error) {
        console.error('Failed to import workflow:', error);
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges]);

  const NodePalette = () => (
    <Card className="w-64 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Node Palette</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-3 space-y-3">
            {['core', 'control', 'integration', 'custom'].map(category => (
              <div key={category}>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {category}
                </h4>
                <div className="space-y-1">
                  {nodePalette
                    .filter(item => item.category === category)
                    .map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.type}
                          className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                          draggable
                          onDragStart={() => setDraggedNodeType(item.type)}
                        >
                          <div className={cn('p-1 rounded', item.color)}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium">{item.label}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {item.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {category !== 'custom' && <Separator className="my-3" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  return (
    <div className={cn('h-full flex bg-gray-50', className)}>
      {/* Node Palette */}
      <div className="flex-shrink-0 border-r bg-white">
        <NodePalette />
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          
          {/* Toolbar */}
          <Panel position="top-right" className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleValidate}
              disabled={isValidating}
            >
              {isValidating ? (
                <Clock className="h-4 w-4" />
              ) : validationErrors.length > 0 ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              Validate
            </Button>
            
            <Button size="sm" variant="outline" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Save
            </Button>
            
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            
            <label className="cursor-pointer">
              <Button size="sm" variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            
            <Button
              size="sm"
              onClick={onExecute}
              disabled={isExecuting || validationErrors.length > 0}
            >
              {isExecuting ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isExecuting ? 'Running' : 'Execute'}
            </Button>
          </Panel>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Panel position="bottom-center">
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Validation Errors:</span>
                  </div>
                  <ul className="mt-1 text-sm text-red-600">
                    {validationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Panel>
          )}

          {/* Execution Status */}
          {isExecuting && (
            <Panel position="top-left">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Activity className="h-4 w-4 animate-pulse" />
                    <span className="text-sm font-medium">Workflow Executing...</span>
                  </div>
                </CardContent>
              </Card>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}