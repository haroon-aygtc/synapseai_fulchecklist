import React, { useState, useCallback, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Save, 
  Settings, 
  Eye, 
  Activity, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  FileText,
  Download,
  Upload,
  Copy,
  Trash2
} from 'lucide-react';

import WorkflowCanvas from './WorkflowCanvas';
import WorkflowNodeProperties from './WorkflowNodeProperties';
import WorkflowExecutionMonitor from './WorkflowExecutionMonitor';
import WorkflowAnalytics from './WorkflowAnalytics';
import WorkflowLogs from './WorkflowLogs';
import WorkflowTemplates from './WorkflowTemplates';
import { useApixEvents } from '@/lib/apix';
import { APIX_CHANNELS } from '@/lib/apix/types';
import { workflowService } from '@/lib/services/workflow-service';
import { Workflow, WorkflowExecution, WorkflowStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import workflowApiService, { WorkflowTemplate } from '@/lib/services/workflow-api-service';

interface WorkflowBuilderProps {
  workflowId?: string;
  onBack?: () => void;
  className?: string;
}

export default function WorkflowBuilder({ 
  workflowId, 
  onBack, 
  className = '' 
}: WorkflowBuilderProps) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [activeTab, setActiveTab] = useState('canvas');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<Record<string, 'idle' | 'running' | 'success' | 'error'>>({});
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Subscribe to workflow events
  const workflowEvents = useApixEvents({
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    filters: { workflowId }
  });

  // Load workflow data
  useEffect(() => {
    if (workflowId) {
      loadWorkflow();
    } else {
      // Create new workflow
      setWorkflow({
        id: 'new',
        name: 'New Workflow',
        description: '',
        templateCategory: 'Custom',
        version: 1,
        status: 'DRAFT' as WorkflowStatus,
        organizationId: '',
        createdBy: '',
        nodes: [],
        edges: [],
        triggers: [],
        variables: [],
        settings: {
          maxExecutionTime: 300000,
          retryPolicy: {
            enabled: false,
            maxAttempts: 3,
            backoffStrategy: 'exponential'
          },
          errorHandling: {
            strategy: 'stop',
            notificationChannels: []
          },
          logging: {
            level: 'basic',
            retention: 30
          }
        },
        tags: [],
        analytics: {
          totalExecutions: 0,
          successRate: 0,
          averageExecutionTime: 0,
          lastExecuted: undefined,
          costMetrics: {
            totalCost: 0,
            averageCostPerExecution: 0
          },
          errorCount: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isTemplate: false
      });
    }
  }, [workflowId]);

  // Handle workflow events
  useEffect(() => {
    workflowEvents.forEach(event => {
      switch (event.type) {
        case 'WORKFLOW_EXECUTION_STARTED':
          setIsExecuting(true);
          setCurrentExecution(event.data);
          break;
        case 'WORKFLOW_EXECUTION_COMPLETED':
          setIsExecuting(false);
          setExecutionStatus({});
          break;
        case 'WORKFLOW_EXECUTION_FAILED':
          setIsExecuting(false);
          setExecutionStatus({});
          break;
        case 'WORKFLOW_NODE_EXECUTED':
          setExecutionStatus(prev => ({
            ...prev,
            [event.data.nodeId]: 'success'
          }));
          break;
        case 'WORKFLOW_NODE_FAILED':
          setExecutionStatus(prev => ({
            ...prev,
            [event.data.nodeId]: 'error'
          }));
          break;
      }
    });
  }, [workflowEvents]);

  const loadWorkflow = async () => {
    if (!workflowId) return;
    
    setIsLoading(true);
    try {
      const data = await workflowService.getWorkflow(workflowId);
      setWorkflow(data as Workflow);
    } catch (error) {
      console.error('Failed to load workflow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    if (!workflow) return;

    setIsSaving(true);
    try {
      const updatedWorkflow = {
        ...workflow,
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type as any,
          label: node.data.label,
          description: node.data.description,
          position: node.position,
          data: node.data,
          style: node.style,
          parentId: node.parentId,
          width: node.width,
          height: node.height
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type as any,
          label: edge.label as string,
          animated: edge.animated,
          style: edge.style,
          data: edge.data
        }))
      };

      if (workflow.id === 'new') {
        const created = await workflowService.createWorkflow(updatedWorkflow as Partial<Workflow>);
        setWorkflow(created as Workflow);
      } else {
        const updated = await workflowService.updateWorkflow(workflow.id, updatedWorkflow as Partial<Workflow>);
        setWorkflow(updated as Workflow);
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setIsSaving(false);
    }
  }, [workflow]);

  const handleExecute = useCallback(async () => {
    if (!workflow || workflow.id === 'new') return;

    try {
      const execution = await workflowService.executeWorkflow(workflow.id);
      setCurrentExecution(execution);
      setIsExecuting(true);
      setExecutionStatus({});
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    }
  }, [workflow]);

  const handleNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node);
    if (node && activeTab === 'canvas') {
      setActiveTab('properties');
    }
  }, [activeTab]);

  const handleNodeUpdate = useCallback((nodeId: string, updates: any) => {
    if (!workflow) return;

    const updatedNodes = workflow.nodes.map(node =>
      node.id === nodeId ? { ...node, ...updates } : node
    );

    setWorkflow({
      ...workflow,
      nodes: updatedNodes
    });

    setHasUnsavedChanges(true);
  }, [workflow]);

  const getStatusIcon = () => {
    if (isExecuting) return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    if (workflow?.status === 'ACTIVE') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (workflow?.status === 'ERROR') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getStatusBadge = () => {
    if (isExecuting) return <Badge className="bg-blue-100 text-blue-800">Executing</Badge>;
    if (workflow?.status === 'ACTIVE') return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    if (workflow?.status === 'INACTIVE') return <Badge className="bg-yellow-100 text-yellow-800">Inactive</Badge>;
    if (workflow?.status === 'ERROR') return <Badge className="bg-red-100 text-red-800">Error</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p>Failed to load workflow</p>
        </div>
      </div>
    );
  }

  function onTemplateSaved(template: WorkflowTemplate) {
    throw new Error('Function not implemented.');
  }

  return (
    <div className={cn('h-screen flex flex-col bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{workflow.name}</h1>
              {getStatusIcon()}
              {getStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground">
              {workflow.description || 'No description'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600">
              Unsaved Changes
            </Badge>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(workflow.nodes as any, workflow.edges as any)}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          <Button
            size="sm"
            onClick={handleExecute}
            disabled={isExecuting || workflow.id === 'new'}
          >
            {isExecuting ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Running
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="border-b bg-white px-4">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="canvas" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Canvas
                </TabsTrigger>
                <TabsTrigger value="monitor" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Monitor
                </TabsTrigger>
                <TabsTrigger value="scheduler" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Logs
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="canvas" className="flex-1 m-0">
              <WorkflowCanvas
                workflowId={workflow.id}
                onSave={handleSave}
                onExecute={handleExecute}
                isExecuting={isExecuting}
                executionStatus={executionStatus as any}
                className="h-full"
              />
            </TabsContent>

            <TabsContent value="monitor" className="flex-1 m-0 p-4">
              <WorkflowExecutionMonitor
                workflowId={workflow.id}
                currentExecution={currentExecution}
                isExecuting={isExecuting}
              />
            </TabsContent>

            <TabsContent value="scheduler" className="flex-1 m-0 p-4">
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Scheduler</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Scheduler functionality will be implemented here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="flex-1 m-0 p-4">
              <WorkflowAnalytics workflowId={workflow.id} />
            </TabsContent>

            <TabsContent value="logs" className="flex-1 m-0 p-4">
              <WorkflowLogs workflowId={workflow.id} />
            </TabsContent>

            <TabsContent value="templates" className="flex-1 m-0 p-4">
              <WorkflowTemplates
                currentWorkflow={workflow}
                onCreateFromTemplate={(template, customizations) => {
                  // Handle template creation
                  // Creating workflow from template with real API integration
                  try {
                    const newWorkflow = workflowApiService.createFromTemplate(template.id, customizations);
                    onTemplateCreated?.(newWorkflow);
                  } catch (error) {
                    // Error handling is done in the service
                  }
                }}
                onSaveAsTemplate={async (workflow) => {
                  // Handle save as template with real API integration
                  try {
                    const template = await workflowApiService.saveAsTemplate(workflow.id, {
                      name: `${workflow.name} Template`,
                      description: workflow.description,
                      category: workflow.templateCategory || 'Custom'
                    });
                    onTemplateSaved?.(template);
                  } catch (error) {
                    // Error handling is done in the service
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="settings" className="flex-1 m-0 p-4">
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={workflow.name}
                      onChange={(e) => {
                        setWorkflow({ ...workflow, name: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      value={workflow.description}
                      onChange={(e) => {
                        setWorkflow({ ...workflow, description: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Execution Timeout (ms)</label>
                    <Input
                      type="number"
                      value={workflow.settings.maxExecutionTime}
                      onChange={(e) => {
                        setWorkflow({
                          ...workflow,
                          settings: {
                            ...workflow.settings,
                            maxExecutionTime: parseInt(e.target.value)
                          }
                        });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Properties Panel */}
        {selectedNode && activeTab === 'canvas' && (
          <div className="w-80 border-l bg-white">
            <WorkflowNodeProperties
              node={selectedNode}
              onUpdate={(updates) => handleNodeUpdate(selectedNode.id, updates)}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}