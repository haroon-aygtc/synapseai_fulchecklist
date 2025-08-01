import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { useApixEvents, useApixPublish } from '@/lib/apix/hooks';
import { APIX_CHANNELS, ApixEvent } from '@/lib/apix/types';
import { 
  Activity, 
  Bot, 
  Zap, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  BarChart3,
  Layers,
  Cpu,
  Timer,
  Pause,
  Play,
  StopCircle,
  Eye,
  Download,
  Filter
} from 'lucide-react';

interface ExecutionMonitorProps {
  type?: 'agent' | 'workflow' | 'tool' | 'all';
  entityId?: string;
  maxItems?: number;
  showControls?: boolean;
  showDetails?: boolean;
  onExecutionSelect?: (execution: any) => void;
  className?: string;
}

export default function ExecutionMonitor({
  type = 'all',
  entityId,
  maxItems = 50,
  showControls = true,
  showDetails = true,
  onExecutionSelect,
  className = ''
}: ExecutionMonitorProps) {
  const { toast } = useToast();
  const publish = useApixPublish();
  
  const [activeTab, setActiveTab] = useState<string>(type !== 'all' ? type : 'all');
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [pollingInterval, setPollingInterval] = useState<number>(5000);
  const [filter, setFilter] = useState<string>('all'); // 'all', 'running', 'completed', 'failed'

  // Subscribe to execution events
  const agentEvents = useApixEvents({
    channel: APIX_CHANNELS.AGENT_EVENTS,
    includeHistory: true,
    historyLimit: maxItems
  });

  const workflowEvents = useApixEvents({
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    includeHistory: true,
    historyLimit: maxItems
  });

  const toolEvents = useApixEvents({
    channel: APIX_CHANNELS.TOOL_EVENTS,
    includeHistory: true,
    historyLimit: maxItems
  });

  // Process events to track executions
  const [agentExecutions, setAgentExecutions] = useState<Record<string, any>>({});
  const [workflowExecutions, setWorkflowExecutions] = useState<Record<string, any>>({});
  const [toolExecutions, setToolExecutions] = useState<Record<string, any>>({});

  // Process agent events
  useEffect(() => {
    const newExecutions = { ...agentExecutions };
    
    for (const event of agentEvents) {
      if (event.type === 'AGENT_EXECUTION_STARTED') {
        newExecutions[event.data.executionId] = {
          id: event.data.executionId,
          agentId: event.data.agentId,
          agentName: event.data.agentName,
          status: 'running',
          progress: 0,
          startedAt: new Date(event.metadata.timestamp),
          steps: [],
          input: event.data.input,
          metadata: event.data.metadata || {}
        };
      } else if (event.type === 'AGENT_EXECUTION_PROGRESS') {
        if (newExecutions[event.data.executionId]) {
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            progress: event.data.progress,
            currentStep: event.data.currentStep,
            steps: [
              ...newExecutions[event.data.executionId].steps,
              {
                id: event.data.stepId,
                type: event.data.stepType,
                status: 'completed',
                timestamp: new Date(event.metadata.timestamp),
                data: event.data.stepData
              }
            ]
          };
        }
      } else if (event.type === 'AGENT_EXECUTION_COMPLETED') {
        if (newExecutions[event.data.executionId]) {
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            status: 'completed',
            progress: 100,
            completedAt: new Date(event.metadata.timestamp),
            output: event.data.output,
            duration: event.data.duration,
            metrics: event.data.metrics
          };
        }
      } else if (event.type === 'AGENT_EXECUTION_FAILED') {
        if (newExecutions[event.data.executionId]) {
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            status: 'failed',
            error: event.data.error,
            completedAt: new Date(event.metadata.timestamp),
            duration: event.data.duration
          };
        }
      }
    }
    
    setAgentExecutions(newExecutions);
  }, [agentEvents]);

  // Process workflow events
  useEffect(() => {
    const newExecutions = { ...workflowExecutions };
    
    for (const event of workflowEvents) {
      if (event.type === 'WORKFLOW_STARTED') {
        newExecutions[event.data.executionId] = {
          id: event.data.executionId,
          workflowId: event.data.workflowId,
          workflowName: event.data.workflowName,
          status: 'running',
          progress: 0,
          startedAt: new Date(event.metadata.timestamp),
          nodes: {},
          edges: {},
          input: event.data.input,
          metadata: event.data.metadata || {}
        };
      } else if (event.type === 'WORKFLOW_NODE_EXECUTED') {
        if (newExecutions[event.data.executionId]) {
          const nodes = { ...newExecutions[event.data.executionId].nodes };
          nodes[event.data.nodeId] = {
            id: event.data.nodeId,
            type: event.data.nodeType,
            status: 'completed',
            startedAt: new Date(event.data.startedAt || event.metadata.timestamp),
            completedAt: new Date(event.metadata.timestamp),
            input: event.data.input,
            output: event.data.output,
            duration: event.data.duration
          };
          
          const totalNodes = Object.keys(event.data.nodeStatuses || {}).length;
          const completedNodes = Object.values(event.data.nodeStatuses || {})
            .filter(status => status === 'completed' || status === 'failed').length;
          
          const progress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
          
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            nodes,
            progress,
            nodeStatuses: event.data.nodeStatuses
          };
        }
      } else if (event.type === 'WORKFLOW_NODE_FAILED') {
        if (newExecutions[event.data.executionId]) {
          const nodes = { ...newExecutions[event.data.executionId].nodes };
          nodes[event.data.nodeId] = {
            id: event.data.nodeId,
            type: event.data.nodeType,
            status: 'failed',
            startedAt: new Date(event.data.startedAt || event.metadata.timestamp),
            completedAt: new Date(event.metadata.timestamp),
            input: event.data.input,
            error: event.data.error,
            duration: event.data.duration
          };
          
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            nodes
          };
        }
      } else if (event.type === 'WORKFLOW_COMPLETED') {
        if (newExecutions[event.data.executionId]) {
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            status: 'completed',
            progress: 100,
            completedAt: new Date(event.metadata.timestamp),
            output: event.data.output,
            duration: event.data.duration,
            metrics: event.data.metrics
          };
        }
      } else if (event.type === 'WORKFLOW_FAILED') {
        if (newExecutions[event.data.executionId]) {
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            status: 'failed',
            error: event.data.error,
            completedAt: new Date(event.metadata.timestamp),
            duration: event.data.duration
          };
        }
      } else if (event.type === 'WORKFLOW_PAUSED') {
        if (newExecutions[event.data.executionId]) {
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            status: 'paused',
            pausedAt: new Date(event.metadata.timestamp),
            pauseReason: event.data.reason
          };
        }
      } else if (event.type === 'WORKFLOW_RESUMED') {
        if (newExecutions[event.data.executionId]) {
          newExecutions[event.data.executionId] = {
            ...newExecutions[event.data.executionId],
            status: 'running',
            resumedAt: new Date(event.metadata.timestamp)
          };
        }
      }
    }
    
    setWorkflowExecutions(newExecutions);
  }, [workflowEvents]);

  // Process tool events
  useEffect(() => {
    const newExecutions = { ...toolExecutions };
    
    for (const event of toolEvents) {
      if (event.type === 'TOOL_EXECUTED') {
        newExecutions[event.data.executionId] = {
          id: event.data.executionId,
          toolId: event.data.toolId,
          toolName: event.data.toolName,
          status: 'completed',
          startedAt: new Date(event.data.startedAt || event.metadata.timestamp),
          completedAt: new Date(event.metadata.timestamp),
          input: event.data.input,
          output: event.data.output,
          duration: event.data.duration,
          metadata: event.data.metadata || {}
        };
      } else if (event.type === 'TOOL_ERROR') {
        newExecutions[event.data.executionId] = {
          id: event.data.executionId,
          toolId: event.data.toolId,
          toolName: event.data.toolName,
          status: 'failed',
          startedAt: new Date(event.data.startedAt || event.metadata.timestamp),
          completedAt: new Date(event.metadata.timestamp),
          input: event.data.input,
          error: event.data.error,
          duration: event.data.duration,
          metadata: event.data.metadata || {}
        };
      }
    }
    
    setToolExecutions(newExecutions);
  }, [toolEvents]);

  // Polling for updates
  useEffect(() => {
    if (!isPolling) return;
    
    const interval = setInterval(() => {
      if (activeTab === 'agent' || activeTab === 'all') {
        publish({
          type: 'AGENT_EXECUTIONS_REQUEST',
          channel: APIX_CHANNELS.AGENT_EVENTS,
          data: { limit: maxItems, entityId }
        });
      }
      
      if (activeTab === 'workflow' || activeTab === 'all') {
        publish({
          type: 'WORKFLOW_EXECUTIONS_REQUEST',
          channel: APIX_CHANNELS.WORKFLOW_EVENTS,
          data: { limit: maxItems, entityId }
        });
      }
      
      if (activeTab === 'tool' || activeTab === 'all') {
        publish({
          type: 'TOOL_EXECUTIONS_REQUEST',
          channel: APIX_CHANNELS.TOOL_EVENTS,
          data: { limit: maxItems, entityId }
        });
      }
    }, pollingInterval);
    
    return () => clearInterval(interval);
  }, [isPolling, pollingInterval, activeTab, publish, maxItems, entityId]);

  // Initial data load
  useEffect(() => {
    // Request initial data
    if (type === 'agent' || type === 'all') {
      publish({
        type: 'AGENT_EXECUTIONS_REQUEST',
        channel: APIX_CHANNELS.AGENT_EVENTS,
        data: { limit: maxItems, entityId }
      });
    }
    
    if (type === 'workflow' || type === 'all') {
      publish({
        type: 'WORKFLOW_EXECUTIONS_REQUEST',
        channel: APIX_CHANNELS.WORKFLOW_EVENTS,
        data: { limit: maxItems, entityId }
      });
    }
    
    if (type === 'tool' || type === 'all') {
      publish({
        type: 'TOOL_EXECUTIONS_REQUEST',
        channel: APIX_CHANNELS.TOOL_EVENTS,
        data: { limit: maxItems, entityId }
      });
    }
  }, [type, publish, maxItems, entityId]);

  // Handle execution selection
  const handleExecutionSelect = (executionId: string, executionType: string) => {
    setSelectedExecution(executionId);
    
    let execution;
    switch (executionType) {
      case 'agent':
        execution = agentExecutions[executionId];
        break;
      case 'workflow':
        execution = workflowExecutions[executionId];
        break;
      case 'tool':
        execution = toolExecutions[executionId];
        break;
    }
    
    if (execution && onExecutionSelect) {
      onExecutionSelect({ ...execution, type: executionType });
    }
  };

  // Toggle polling
  const togglePolling = () => {
    setIsPolling(!isPolling);
    
    toast({
      title: isPolling ? 'Monitoring paused' : 'Monitoring resumed',
      description: isPolling 
        ? 'Real-time updates have been paused.' 
        : 'Real-time updates have been resumed.',
      variant: isPolling ? 'default' : 'default'
    });
  };

  // Export executions data
  const exportData = () => {
    const data = {
      agents: agentExecutions,
      workflows: workflowExecutions,
      tools: toolExecutions,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executions-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Export successful',
      description: 'Execution data has been exported to JSON.',
    });
  };

  // Filter executions based on status
  const getFilteredExecutions = (executions: Record<string, any>) => {
    return Object.values(executions)
      .filter(execution => {
        if (filter === 'all') return true;
        return execution.status === filter;
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Running
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1">
            <Pause className="h-3 w-3" />
            Paused
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {status}
          </Badge>
        );
    }
  };

  // Render execution item
  const renderExecutionItem = (execution: any, type: string) => {
    const isSelected = selectedExecution === execution.id;
    
    return (
      <div
        key={execution.id}
        className={`p-3 border rounded-md mb-2 cursor-pointer transition-colors ${
          isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => handleExecutionSelect(execution.id, type)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {type === 'agent' && <Bot className="h-5 w-5 text-blue-500" />}
            {type === 'workflow' && <Layers className="h-5 w-5 text-purple-500" />}
            {type === 'tool' && <Zap className="h-5 w-5 text-yellow-500" />}
            <div>
              <p className="font-medium">
                {type === 'agent' && (execution.agentName || 'Agent')}
                {type === 'workflow' && (execution.workflowName || 'Workflow')}
                {type === 'tool' && (execution.toolName || 'Tool')}
              </p>
              <p className="text-xs text-gray-500">
                ID: {execution.id.substring(0, 8)}...
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {renderStatusBadge(execution.status)}
            <span className="text-xs text-gray-500 mt-1">
              {new Date(execution.startedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {execution.status === 'running' && (
          <div className="mt-2">
            <Progress value={execution.progress || 0} className="h-1" />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs font-medium">{execution.progress || 0}%</span>
            </div>
          </div>
        )}
        
        {execution.status === 'completed' && execution.duration && (
          <div className="flex items-center mt-2 text-xs text-gray-500">
            <Timer className="h-3 w-3 mr-1" />
            Completed in {(execution.duration / 1000).toFixed(2)}s
          </div>
        )}
        
        {execution.status === 'failed' && execution.error && (
          <div className="flex items-center mt-2 text-xs text-red-500 truncate">
            <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
            {execution.error.substring(0, 50)}{execution.error.length > 50 ? '...' : ''}
          </div>
        )}
      </div>
    );
  };

  // Render execution details
  const renderExecutionDetails = () => {
    if (!selectedExecution) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <Eye className="h-12 w-12 text-gray-300 mb-2" />
          <h3 className="text-lg font-medium text-gray-500">Select an execution to view details</h3>
          <p className="text-sm text-gray-400 mt-1">
            Click on any execution from the list to see detailed information
          </p>
        </div>
      );
    }
    
    let execution;
    let executionType;
    
    if (selectedExecution in agentExecutions) {
      execution = agentExecutions[selectedExecution];
      executionType = 'agent';
    } else if (selectedExecution in workflowExecutions) {
      execution = workflowExecutions[selectedExecution];
      executionType = 'workflow';
    } else if (selectedExecution in toolExecutions) {
      execution = toolExecutions[selectedExecution];
      executionType = 'tool';
    }
    
    if (!execution) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <AlertCircle className="h-12 w-12 text-red-300 mb-2" />
          <h3 className="text-lg font-medium text-gray-500">Execution not found</h3>
        </div>
      );
    }
    
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">
              {executionType === 'agent' && (execution.agentName || 'Agent')}
              {executionType === 'workflow' && (execution.workflowName || 'Workflow')}
              {executionType === 'tool' && (execution.toolName || 'Tool')}
              {' '}Execution
            </h3>
            <p className="text-sm text-gray-500">ID: {execution.id}</p>
          </div>
          <div>
            {renderStatusBadge(execution.status)}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-500">Started</h4>
                <Clock className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-lg font-medium mt-1">
                {new Date(execution.startedAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-500">Duration</h4>
                <Timer className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-lg font-medium mt-1">
                {execution.duration 
                  ? `${(execution.duration / 1000).toFixed(2)}s` 
                  : execution.status === 'running'
                    ? 'Running...'
                    : 'N/A'
                }
              </p>
            </CardContent>
          </Card>
        </div>
        
        {execution.status === 'running' && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Progress</h4>
              <Progress value={execution.progress || 0} className="h-2" />
              <div className="flex justify-between mt-2">
                <span className="text-sm">{execution.progress || 0}% Complete</span>
                {executionType === 'workflow' && execution.currentNode && (
                  <span className="text-sm text-gray-500">
                    Current: {execution.currentNode}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {execution.status === 'failed' && execution.error && (
          <Card className="mb-4 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center text-red-600 mb-2">
                <AlertCircle className="h-5 w-5 mr-2" />
                <h4 className="font-medium">Error</h4>
              </div>
              <p className="text-sm text-red-600 whitespace-pre-wrap">
                {execution.error}
              </p>
            </CardContent>
          </Card>
        )}
        
        {executionType === 'workflow' && execution.nodes && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Nodes</CardTitle>
              <CardDescription>Execution path and node statuses</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {Object.values(execution.nodes).map((node: any) => (
                    <div key={node.id} className="border rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {node.type === 'agent' && <Bot className="h-4 w-4 text-blue-500 mr-2" />}
                          {node.type === 'tool' && <Zap className="h-4 w-4 text-yellow-500 mr-2" />}
                          {node.type === 'condition' && <GitBranch className="h-4 w-4 text-orange-500 mr-2" />}
                          {node.type === 'loop' && <RefreshCw className="h-4 w-4 text-indigo-500 mr-2" />}
                          {node.type === 'human_input' && <User className="h-4 w-4 text-pink-500 mr-2" />}
                          <span className="font-medium">{node.id}</span>
                        </div>
                        {renderStatusBadge(node.status)}
                      </div>
                      
                      {node.duration && (
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <Timer className="h-3 w-3 mr-1" />
                          {(node.duration / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
        
        {executionType === 'agent' && execution.steps && execution.steps.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Steps</CardTitle>
              <CardDescription>Agent execution steps</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {execution.steps.map((step: any, index: number) => (
                    <div key={index} className="border rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="font-medium">{step.type}</span>
                        </div>
                        {renderStatusBadge(step.status || 'completed')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(step.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
        
        {execution.metrics && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Metrics</CardTitle>
              <CardDescription>Performance and resource usage</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {execution.metrics.totalTokens !== undefined && (
                  <div>
                    <div className="text-sm text-gray-500">Tokens Used</div>
                    <div className="text-lg font-medium">{execution.metrics.totalTokens}</div>
                  </div>
                )}
                
                {execution.metrics.totalCost !== undefined && (
                  <div>
                    <div className="text-sm text-gray-500">Cost</div>
                    <div className="text-lg font-medium">${execution.metrics.totalCost.toFixed(6)}</div>
                  </div>
                )}
                
                {execution.metrics.memoryPeak !== undefined && (
                  <div>
                    <div className="text-sm text-gray-500">Memory Peak</div>
                    <div className="text-lg font-medium">{(execution.metrics.memoryPeak / (1024 * 1024)).toFixed(2)} MB</div>
                  </div>
                )}
                
                {execution.metrics.cpuTime !== undefined && (
                  <div>
                    <div className="text-sm text-gray-500">CPU Time</div>
                    <div className="text-lg font-medium">{(execution.metrics.cpuTime / 1000).toFixed(2)}s</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Input</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-48">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(execution.input, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {execution.status === 'completed' ? 'Output' : 'Result'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-48">
                <pre className="text-xs whitespace-pre-wrap">
                  {execution.output 
                    ? JSON.stringify(execution.output, null, 2)
                    : execution.error
                      ? JSON.stringify({ error: execution.error }, null, 2)
                      : execution.status === 'running'
                        ? 'Execution in progress...'
                        : 'No output available'
                  }
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Execution Monitor</CardTitle>
            <CardDescription>
              Real-time monitoring of executions
            </CardDescription>
          </div>
          {showControls && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePolling}
              >
                {isPolling ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportData}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row h-[600px] gap-4">
          <div className="w-full md:w-1/3 border rounded-md overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b px-3">
                <TabsList className="grid w-full grid-cols-4">
                  {type === 'all' && <TabsTrigger value="all">All</TabsTrigger>}
                  {(type === 'agent' || type === 'all') && <TabsTrigger value="agent">Agents</TabsTrigger>}
                  {(type === 'workflow' || type === 'all') && <TabsTrigger value="workflow">Workflows</TabsTrigger>}
                  {(type === 'tool' || type === 'all') && <TabsTrigger value="tool">Tools</TabsTrigger>}
                </TabsList>
              </div>
              
              <div className="border-b p-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs h-7 ${filter === 'all' ? 'bg-gray-200' : ''}`}
                      onClick={() => setFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs h-7 ${filter === 'running' ? 'bg-gray-200' : ''}`}
                      onClick={() => setFilter('running')}
                    >
                      Running
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs h-7 ${filter === 'completed' ? 'bg-gray-200' : ''}`}
                      onClick={() => setFilter('completed')}
                    >
                      Completed
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs h-7 ${filter === 'failed' ? 'bg-gray-200' : ''}`}
                      onClick={() => setFilter('failed')}
                    >
                      Failed
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    <Filter className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <TabsContent value="all" className="m-0 p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3">
                    {[...getFilteredExecutions(agentExecutions), ...getFilteredExecutions(workflowExecutions), ...getFilteredExecutions(toolExecutions)]
                      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                      .map(execution => {
                        let type = 'unknown';
                        if ('agentId' in execution) type = 'agent';
                        else if ('workflowId' in execution) type = 'workflow';
                        else if ('toolId' in execution) type = 'tool';
                        
                        return renderExecutionItem(execution, type);
                      })}
                    
                    {getFilteredExecutions(agentExecutions).length === 0 && 
                     getFilteredExecutions(workflowExecutions).length === 0 && 
                     getFilteredExecutions(toolExecutions).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Activity className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500">No executions found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="agent" className="m-0 p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3">
                    {getFilteredExecutions(agentExecutions).map(execution => 
                      renderExecutionItem(execution, 'agent')
                    )}
                    
                    {getFilteredExecutions(agentExecutions).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Bot className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500">No agent executions found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="workflow" className="m-0 p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3">
                    {getFilteredExecutions(workflowExecutions).map(execution => 
                      renderExecutionItem(execution, 'workflow')
                    )}
                    
                    {getFilteredExecutions(workflowExecutions).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Layers className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500">No workflow executions found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="tool" className="m-0 p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3">
                    {getFilteredExecutions(toolExecutions).map(execution => 
                      renderExecutionItem(execution, 'tool')
                    )}
                    
                    {getFilteredExecutions(toolExecutions).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Zap className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500">No tool executions found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          
          {showDetails && (
            <div className="w-full md:w-2/3 border rounded-md overflow-hidden">
              <ScrollArea className="h-[600px]">
                {renderExecutionDetails()}
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500">
            {isPolling ? (
              <span className="flex items-center">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1" />
                Monitoring active
              </span>
            ) : (
              <span className="flex items-center">
                <span className="h-2 w-2 rounded-full bg-yellow-500 mr-1" />
                Monitoring paused
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">
              Refresh rate:
            </span>
            <select
              className="text-xs border rounded px-1 py-0.5"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
            >
              <option value={1000}>1s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}