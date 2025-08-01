import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  Eye,
  Zap,
  BarChart3,
  RefreshCw,
  Maximize2,
  Minimize2,
  Filter,
  Search
} from 'lucide-react';
import { useApixEvents, APIX_CHANNELS } from '@/lib/apix';
import { workflowService } from '@/lib/services/workflow-service';
import { Workflow, WorkflowExecution, WorkflowExecutionStatus } from '@/lib/workflows/types';
import { cn } from '@/lib/utils';

interface WorkflowExecutionMonitorProps {
  workflow: Workflow;
  currentExecution?: WorkflowExecution | null;
  isExecuting?: boolean;
  className?: string;
}

interface NodeExecutionState {
  nodeId: string;
  nodeName: string;
  status: WorkflowExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  progress?: number;
  retryCount?: number;
  logs: Array<{
    timestamp: Date;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
  }>;
}

interface ExecutionMetrics {
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  runningNodes: number;
  pendingNodes: number;
  totalDuration: number;
  averageNodeDuration: number;
  successRate: number;
  throughput: number;
}

export default function WorkflowExecutionMonitor({ 
  workflow, 
  currentExecution, 
  isExecuting = false,
  className = '' 
}: WorkflowExecutionMonitorProps) {
  const [nodeStates, setNodeStates] = useState<Record<string, NodeExecutionState>>({});
  const [executionHistory, setExecutionHistory] = useState<WorkflowExecution[]>([]);
  const [metrics, setMetrics] = useState<ExecutionMetrics | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  // Subscribe to workflow execution events
  const executionEvents = useApixEvents({
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    filters: { workflowId: workflow.id }
  });

  useEffect(() => {
    initializeNodeStates();
    loadExecutionHistory();
  }, [workflow]);

  useEffect(() => {
    if (currentExecution) {
      updateFromExecution(currentExecution);
    }
  }, [currentExecution]);

  useEffect(() => {
    // Process real-time execution events
    executionEvents.forEach(event => {
      switch (event.type) {
        case 'WORKFLOW_EXECUTION_STARTED':
          handleExecutionStarted(event.data);
          break;
        case 'WORKFLOW_EXECUTION_COMPLETED':
          handleExecutionCompleted(event.data);
          break;
        case 'WORKFLOW_EXECUTION_FAILED':
          handleExecutionFailed(event.data);
          break;
        case 'WORKFLOW_NODE_STARTED':
          handleNodeStarted(event.data);
          break;
        case 'WORKFLOW_NODE_COMPLETED':
          handleNodeCompleted(event.data);
          break;
        case 'WORKFLOW_NODE_FAILED':
          handleNodeFailed(event.data);
          break;
        case 'WORKFLOW_NODE_PROGRESS':
          handleNodeProgress(event.data);
          break;
        case 'WORKFLOW_LOG':
          handleLogEvent(event.data);
          break;
      }
    });
  }, [executionEvents]);

  const initializeNodeStates = () => {
    const initialStates: Record<string, NodeExecutionState> = {};
    
    workflow.nodes.forEach(node => {
      initialStates[node.id] = {
        nodeId: node.id,
        nodeName: node.label || `Node ${node.id.slice(0, 8)}`,
        status: WorkflowExecutionStatus.PENDING,
        logs: []
      };
    });

    setNodeStates(initialStates);
    calculateMetrics(initialStates);
  };

  const updateFromExecution = (execution: WorkflowExecution) => {
    const updatedStates = { ...nodeStates };

    execution.nodeExecutions.forEach(nodeExec => {
      if (updatedStates[nodeExec.nodeId]) {
        updatedStates[nodeExec.nodeId] = {
          ...updatedStates[nodeExec.nodeId],
          status: nodeExec.status,
          startedAt: nodeExec.startedAt,
          completedAt: nodeExec.completedAt,
          duration: nodeExec.duration,
          input: nodeExec.input,
          output: nodeExec.output,
          error: nodeExec.error,
          retryCount: nodeExec.retryCount
        };
      }
    });

    setNodeStates(updatedStates);
    calculateMetrics(updatedStates);
  };

  const loadExecutionHistory = async () => {
    try {
      const response = await workflowService.getWorkflowExecutions(workflow.id, {
        limit: 10
      });
      setExecutionHistory(response.executions);
    } catch (error) {
      console.error('Failed to load execution history:', error);
    }
  };

  const calculateMetrics = (states: Record<string, NodeExecutionState>) => {
    const nodes = Object.values(states);
    const totalNodes = nodes.length;
    const completedNodes = nodes.filter(n => n.status === WorkflowExecutionStatus.COMPLETED).length;
    const failedNodes = nodes.filter(n => n.status === WorkflowExecutionStatus.FAILED).length;
    const runningNodes = nodes.filter(n => n.status === WorkflowExecutionStatus.RUNNING).length;
    const pendingNodes = nodes.filter(n => n.status === WorkflowExecutionStatus.PENDING).length;

    const completedWithDuration = nodes.filter(n => n.duration && n.status === WorkflowExecutionStatus.COMPLETED);
    const totalDuration = completedWithDuration.reduce((sum, n) => sum + (n.duration || 0), 0);
    const averageNodeDuration = completedWithDuration.length > 0 ? totalDuration / completedWithDuration.length : 0;

    const successRate = totalNodes > 0 ? (completedNodes / (completedNodes + failedNodes)) * 100 : 0;
    const throughput = currentExecution ? 
      (completedNodes / ((Date.now() - currentExecution.startedAt.getTime()) / 1000)) : 0;

    setMetrics({
      totalNodes,
      completedNodes,
      failedNodes,
      runningNodes,
      pendingNodes,
      totalDuration,
      averageNodeDuration,
      successRate: isNaN(successRate) ? 0 : successRate,
      throughput
    });
  };

  const handleExecutionStarted = (data: any) => {
    const updatedStates = { ...nodeStates };
    Object.keys(updatedStates).forEach(nodeId => {
      updatedStates[nodeId].status = WorkflowExecutionStatus.PENDING;
      updatedStates[nodeId].logs = [];
    });
    setNodeStates(updatedStates);
  };

  const handleExecutionCompleted = (data: any) => {
    loadExecutionHistory();
  };

  const handleExecutionFailed = (data: any) => {
    loadExecutionHistory();
  };

  const handleNodeStarted = (data: any) => {
    setNodeStates(prev => ({
      ...prev,
      [data.nodeId]: {
        ...prev[data.nodeId],
        status: WorkflowExecutionStatus.RUNNING,
        startedAt: new Date(data.startedAt),
        progress: 0
      }
    }));
  };

  const handleNodeCompleted = (data: any) => {
    setNodeStates(prev => ({
      ...prev,
      [data.nodeId]: {
        ...prev[data.nodeId],
        status: WorkflowExecutionStatus.COMPLETED,
        completedAt: new Date(data.completedAt),
        duration: data.duration,
        output: data.output,
        progress: 100
      }
    }));
  };

  const handleNodeFailed = (data: any) => {
    setNodeStates(prev => ({
      ...prev,
      [data.nodeId]: {
        ...prev[data.nodeId],
        status: WorkflowExecutionStatus.FAILED,
        completedAt: new Date(data.completedAt),
        duration: data.duration,
        error: data.error,
        progress: 0
      }
    }));
  };

  const handleNodeProgress = (data: any) => {
    setNodeStates(prev => ({
      ...prev,
      [data.nodeId]: {
        ...prev[data.nodeId],
        progress: data.progress
      }
    }));
  };

  const handleLogEvent = (data: any) => {
    if (data.nodeId && nodeStates[data.nodeId]) {
      setNodeStates(prev => ({
        ...prev,
        [data.nodeId]: {
          ...prev[data.nodeId],
          logs: [
            ...prev[data.nodeId].logs,
            {
              timestamp: new Date(data.timestamp),
              level: data.level,
              message: data.message
            }
          ].slice(-50) // Keep only last 50 logs per node
        }
      }));
    }
  };

  const getStatusIcon = (status: WorkflowExecutionStatus) => {
    switch (status) {
      case WorkflowExecutionStatus.PENDING:
        return <Clock className="h-4 w-4 text-gray-500" />;
      case WorkflowExecutionStatus.RUNNING:
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case WorkflowExecutionStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case WorkflowExecutionStatus.FAILED:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case WorkflowExecutionStatus.CANCELLED:
        return <Square className="h-4 w-4 text-orange-500" />;
      case WorkflowExecutionStatus.PAUSED:
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: WorkflowExecutionStatus) => {
    const variants = {
      [WorkflowExecutionStatus.PENDING]: 'secondary',
      [WorkflowExecutionStatus.RUNNING]: 'default',
      [WorkflowExecutionStatus.COMPLETED]: 'default',
      [WorkflowExecutionStatus.FAILED]: 'destructive',
      [WorkflowExecutionStatus.CANCELLED]: 'outline',
      [WorkflowExecutionStatus.PAUSED]: 'outline'
    };

    const colors = {
      [WorkflowExecutionStatus.PENDING]: 'bg-gray-100 text-gray-800',
      [WorkflowExecutionStatus.RUNNING]: 'bg-blue-100 text-blue-800',
      [WorkflowExecutionStatus.COMPLETED]: 'bg-green-100 text-green-800',
      [WorkflowExecutionStatus.FAILED]: 'bg-red-100 text-red-800',
      [WorkflowExecutionStatus.CANCELLED]: 'bg-orange-100 text-orange-800',
      [WorkflowExecutionStatus.PAUSED]: 'bg-yellow-100 text-yellow-800'
    };

    return (
      <Badge className={colors[status]}>
        {status.toLowerCase()}
      </Badge>
    );
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getOverallProgress = () => {
    if (!metrics) return 0;
    return (metrics.completedNodes / metrics.totalNodes) * 100;
  };

  const filteredNodes = Object.values(nodeStates).filter(node => {
    if (showOnlyActive) {
      return node.status === WorkflowExecutionStatus.RUNNING || 
             node.status === WorkflowExecutionStatus.FAILED ||
             node.logs.length > 0;
    }
    return true;
  });

  return (
    <div className={cn('space-y-6 bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Execution Monitor
          </h2>
          <p className="text-muted-foreground">
            Real-time workflow execution monitoring and debugging
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyActive(!showOnlyActive)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showOnlyActive ? 'Show All' : 'Active Only'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4 mr-2" />
            ) : (
              <Maximize2 className="h-4 w-4 mr-2" />
            )}
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {/* Execution Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{getOverallProgress().toFixed(1)}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
            <Progress value={getOverallProgress()} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Nodes</p>
                <p className="text-2xl font-bold">{metrics?.runningNodes || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{metrics?.successRate.toFixed(1) || 0}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">{formatDuration(metrics?.averageNodeDuration)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Node Execution States */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Node Execution States
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className={cn('p-4', isExpanded ? 'h-[800px]' : 'h-[400px]')}>
              <div className="space-y-2">
                {filteredNodes.map(node => (
                  <div
                    key={node.nodeId}
                    className={cn(
                      'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
                      selectedNode === node.nodeId ? 'bg-muted border-primary' : 'hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedNode(node.nodeId)}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(node.status)}
                      <div>
                        <p className="font-medium">{node.nodeName}</p>
                        <p className="text-sm text-muted-foreground">
                          {node.nodeId.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {getStatusBadge(node.status)}
                      {node.duration && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDuration(node.duration)}
                        </p>
                      )}
                      {node.progress !== undefined && node.status === WorkflowExecutionStatus.RUNNING && (
                        <div className="w-20 mt-1">
                          <Progress value={node.progress} className="h-1" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Node Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Node Details
              {selectedNode && (
                <Badge variant="outline">
                  {nodeStates[selectedNode]?.nodeName}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNode && nodeStates[selectedNode] ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      {getStatusBadge(nodeStates[selectedNode].status)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Duration</label>
                    <p className="mt-1 font-medium">
                      {formatDuration(nodeStates[selectedNode].duration)}
                    </p>
                  </div>
                </div>

                {nodeStates[selectedNode].startedAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Started At</label>
                    <p className="mt-1 font-medium">
                      {nodeStates[selectedNode].startedAt!.toLocaleString()}
                    </p>
                  </div>
                )}

                {nodeStates[selectedNode].error && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Error</label>
                    <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      {nodeStates[selectedNode].error}
                    </div>
                  </div>
                )}

                {nodeStates[selectedNode].logs.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Recent Logs</label>
                    <ScrollArea className="mt-1 h-32 border rounded">
                      <div className="p-2 space-y-1">
                        {nodeStates[selectedNode].logs.slice(-10).map((log, index) => (
                          <div key={index} className="text-xs">
                            <span className="text-muted-foreground">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                            <span className={cn(
                              'ml-2 font-medium',
                              log.level === 'ERROR' ? 'text-red-600' :
                              log.level === 'WARN' ? 'text-yellow-600' :
                              log.level === 'INFO' ? 'text-blue-600' : 'text-gray-600'
                            )}>
                              [{log.level}]
                            </span>
                            <span className="ml-2">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {nodeStates[selectedNode].retryCount && nodeStates[selectedNode].retryCount! > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Retry Count</label>
                    <p className="mt-1 font-medium">
                      {nodeStates[selectedNode].retryCount}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Select a node to view details</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Executions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Executions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {executionHistory.slice(0, 5).map(execution => (
              <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(execution.status)}
                  <div>
                    <p className="font-medium">
                      Execution {execution.id.slice(0, 8)}...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {execution.startedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  {getStatusBadge(execution.status)}
                  {execution.duration && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDuration(execution.duration)}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {executionHistory.length === 0 && (
              <div className="flex items-center justify-center h-16">
                <p className="text-muted-foreground">No recent executions</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}