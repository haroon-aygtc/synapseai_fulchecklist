'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  NodeTypes,
  EdgeTypes,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Filter,
  MoreHorizontal,
  Maximize2,
  Minimize2
} from 'lucide-react';

import { useApix } from '@/lib/apix/hooks';
import { cn } from '@/lib/utils';

// Custom Node Components
const AgentNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  return (
    <div className={cn(
      "bg-gradient-to-br from-blue-50 to-blue-100 border-2 rounded-xl shadow-lg transition-all duration-200 min-w-[200px]",
      selected ? "border-blue-500 shadow-xl" : "border-blue-200",
      "hover:shadow-xl hover:scale-105"
    )}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-900">{data.name || 'Agent'}</h3>
            <p className="text-xs text-gray-600">{data.type || 'Standalone'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="h-6 w-6 p-0"
          >
            <Settings className="w-3 h-3" />
          </Button>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {data.model || 'GPT-4'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {data.temperature || 0.7}°
            </Badge>
          </div>
          
          {data.status && (
            <div className="flex items-center gap-1">
              {data.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
              {data.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-500" />}
              {data.status === 'failed' && <XCircle className="w-3 h-3 text-red-500" />}
              <span className="text-xs text-gray-600 capitalize">{data.status}</span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Agent: {data.name}</DialogTitle>
          </DialogHeader>
          <AgentConfigForm data={data} onSave={() => setIsConfigOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ToolNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  return (
    <div className={cn(
      "bg-gradient-to-br from-green-50 to-green-100 border-2 rounded-xl shadow-lg transition-all duration-200 min-w-[200px]",
      selected ? "border-green-500 shadow-xl" : "border-green-200",
      "hover:shadow-xl hover:scale-105"
    )}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-green-500 rounded-lg">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-900">{data.name || 'Tool'}</h3>
            <p className="text-xs text-gray-600">{data.type || 'Function'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="h-6 w-6 p-0"
          >
            <Settings className="w-3 h-3" />
          </Button>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {data.category || 'General'}
            </Badge>
            {data.version && (
              <Badge variant="outline" className="text-xs">
                v{data.version}
              </Badge>
            )}
          </div>
          
          {data.status && (
            <div className="flex items-center gap-1">
              {data.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-green-500" />}
              {data.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-500" />}
              {data.status === 'failed' && <XCircle className="w-3 h-3 text-red-500" />}
              <span className="text-xs text-gray-600 capitalize">{data.status}</span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Tool: {data.name}</DialogTitle>
          </DialogHeader>
          <ToolConfigForm data={data} onSave={() => setIsConfigOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const HybridNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  return (
    <div className={cn(
      "bg-gradient-to-br from-purple-50 to-purple-100 border-2 rounded-xl shadow-lg transition-all duration-200 min-w-[200px]",
      selected ? "border-purple-500 shadow-xl" : "border-purple-200",
      "hover:shadow-xl hover:scale-105"
    )}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-purple-500 rounded-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-900">{data.name || 'Hybrid'}</h3>
            <p className="text-xs text-gray-600">{data.mode || 'Agent-First'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="h-6 w-6 p-0"
          >
            <Settings className="w-3 h-3" />
          </Button>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {data.agentName || 'No Agent'}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {data.toolName || 'No Tool'}
            </Badge>
          </div>
          
          {data.status && (
            <div className="flex items-center gap-1">
              {data.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
              {data.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-500" />}
              {data.status === 'failed' && <XCircle className="w-3 h-3 text-red-500" />}
              <span className="text-xs text-gray-600 capitalize">{data.status}</span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Hybrid Node: {data.name}</DialogTitle>
          </DialogHeader>
          <HybridConfigForm data={data} onSave={() => setIsConfigOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ConditionNode = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div className={cn(
      "bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 rounded-xl shadow-lg transition-all duration-200 min-w-[160px]",
      selected ? "border-yellow-500 shadow-xl" : "border-yellow-200",
      "hover:shadow-xl hover:scale-105"
    )}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-yellow-500 rounded-lg">
            <GitBranch className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-xs text-gray-900">Condition</h3>
            <p className="text-xs text-gray-600 truncate">{data.condition || 'if/else'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const HumanInputNode = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div className={cn(
      "bg-gradient-to-br from-orange-50 to-orange-100 border-2 rounded-xl shadow-lg transition-all duration-200 min-w-[160px]",
      selected ? "border-orange-500 shadow-xl" : "border-orange-200",
      "hover:shadow-xl hover:scale-105"
    )}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-orange-500 rounded-lg">
            <Users className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-xs text-gray-900">Human Input</h3>
            <p className="text-xs text-gray-600">{data.inputType || 'Text'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Node Types
const nodeTypes: NodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  hybrid: HybridNode,
  condition: ConditionNode,
  humanInput: HumanInputNode,
};

// Configuration Forms
const AgentConfigForm = ({ data, onSave }: { data: any; onSave: () => void }) => {
  const [config, setConfig] = useState(data);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Enter agent name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Agent Type</Label>
              <Select value={config.type || 'standalone'} onValueChange={(value) => setConfig({ ...config, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone</SelectItem>
                  <SelectItem value="tool-driven">Tool-Driven</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="multi-task">Multi-Task</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={config.description || ''}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              placeholder="Describe what this agent does"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={config.systemPrompt || ''}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              placeholder="Enter system prompt for the agent"
              rows={4}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="model" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={config.model || 'gpt-4'} onValueChange={(value) => setConfig({ ...config, model: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                value={config.maxTokens || 2048}
                onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                min={1}
                max={32000}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Temperature: {config.temperature || 0.7}</Label>
            <Slider
              value={[config.temperature || 0.7]}
              onValueChange={([value]) => setConfig({ ...config, temperature: value })}
              max={2}
              min={0}
              step={0.1}
              className="w-full"
            />
          </div>
        </TabsContent>
        
        <TabsContent value="tools" className="space-y-4">
          <div className="space-y-2">
            <Label>Available Tools</Label>
            <div className="border rounded-lg p-4 space-y-2 max-h-40 overflow-y-auto">
              {['web-search', 'calculator', 'file-reader', 'email-sender'].map((tool) => (
                <div key={tool} className="flex items-center space-x-2">
                  <Switch
                    id={tool}
                    checked={config.tools?.includes(tool) || false}
                    onCheckedChange={(checked) => {
                      const tools = config.tools || [];
                      if (checked) {
                        setConfig({ ...config, tools: [...tools, tool] });
                      } else {
                        setConfig({ ...config, tools: tools.filter((t: string) => t !== tool) });
                      }
                    }}
                  />
                  <Label htmlFor={tool} className="capitalize">{tool.replace('-', ' ')}</Label>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <div className="space-y-2">
            <Label>Memory Settings</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="persistentMemory"
                  checked={config.persistentMemory || false}
                  onCheckedChange={(checked) => setConfig({ ...config, persistentMemory: checked })}
                />
                <Label htmlFor="persistentMemory">Persistent Memory</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="contextAware"
                  checked={config.contextAware || true}
                  onCheckedChange={(checked) => setConfig({ ...config, contextAware: checked })}
                />
                <Label htmlFor="contextAware">Context Aware</Label>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSave}>Cancel</Button>
        <Button onClick={onSave}>Save Configuration</Button>
      </div>
    </div>
  );
};

const ToolConfigForm = ({ data, onSave }: { data: any; onSave: () => void }) => {
  const [config, setConfig] = useState(data);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tool Name</Label>
              <Input
                id="name"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Enter tool name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tool Type</Label>
              <Select value={config.type || 'function'} onValueChange={(value) => setConfig({ ...config, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="function">Function Caller</SelectItem>
                  <SelectItem value="api">REST API</SelectItem>
                  <SelectItem value="rag">RAG Retrieval</SelectItem>
                  <SelectItem value="browser">Browser Automation</SelectItem>
                  <SelectItem value="database">Database Query</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={config.description || ''}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              placeholder="Describe what this tool does"
              rows={3}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="config" className="space-y-4">
          {config.type === 'api' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="endpoint">API Endpoint</Label>
                <Input
                  id="endpoint"
                  value={config.endpoint || ''}
                  onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                  placeholder="https://api.example.com/endpoint"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method">HTTP Method</Label>
                  <Select value={config.method || 'GET'} onValueChange={(value) => setConfig({ ...config, method: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={config.timeout || 30000}
                    onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </>
          )}
          
          {config.type === 'function' && (
            <div className="space-y-2">
              <Label htmlFor="code">Function Code</Label>
              <Textarea
                id="code"
                value={config.code || ''}
                onChange={(e) => setConfig({ ...config, code: e.target.value })}
                placeholder="function execute(input) { return input; }"
                rows={8}
                className="font-mono text-sm"
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="schema" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inputSchema">Input Schema (JSON)</Label>
              <Textarea
                id="inputSchema"
                value={JSON.stringify(config.inputSchema || {}, null, 2)}
                onChange={(e) => {
                  try {
                    setConfig({ ...config, inputSchema: JSON.parse(e.target.value) });
                  } catch {}
                }}
                placeholder='{"type": "object", "properties": {}}'
                rows={6}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outputSchema">Output Schema (JSON)</Label>
              <Textarea
                id="outputSchema"
                value={JSON.stringify(config.outputSchema || {}, null, 2)}
                onChange={(e) => {
                  try {
                    setConfig({ ...config, outputSchema: JSON.parse(e.target.value) });
                  } catch {}
                }}
                placeholder='{"type": "object", "properties": {}}'
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSave}>Cancel</Button>
        <Button onClick={onSave}>Save Configuration</Button>
      </div>
    </div>
  );
};

const HybridConfigForm = ({ data, onSave }: { data: any; onSave: () => void }) => {
  const [config, setConfig] = useState(data);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Hybrid Node Name</Label>
          <Input
            id="name"
            value={config.name || ''}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="Enter hybrid node name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="mode">Execution Mode</Label>
          <Select value={config.mode || 'agent-first'} onValueChange={(value) => setConfig({ ...config, mode: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent-first">Agent First</SelectItem>
              <SelectItem value="tool-first">Tool First</SelectItem>
              <SelectItem value="parallel">Parallel</SelectItem>
              <SelectItem value="conditional">Conditional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agentId">Select Agent</Label>
            <Select value={config.agentId || ''} onValueChange={(value) => setConfig({ ...config, agentId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent1">Customer Support Agent</SelectItem>
                <SelectItem value="agent2">Data Analysis Agent</SelectItem>
                <SelectItem value="agent3">Content Writer Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="toolId">Select Tool</Label>
            <Select value={config.toolId || ''} onValueChange={(value) => setConfig({ ...config, toolId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tool" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tool1">Web Search Tool</SelectItem>
                <SelectItem value="tool2">Database Query Tool</SelectItem>
                <SelectItem value="tool3">Email Sender Tool</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Coordination Settings</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="shareContext"
                checked={config.shareContext || true}
                onCheckedChange={(checked) => setConfig({ ...config, shareContext: checked })}
              />
              <Label htmlFor="shareContext">Share Context Between Agent & Tool</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="errorFallback"
                checked={config.errorFallback || false}
                onCheckedChange={(checked) => setConfig({ ...config, errorFallback: checked })}
              />
              <Label htmlFor="errorFallback">Enable Error Fallback</Label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSave}>Cancel</Button>
        <Button onClick={onSave}>Save Configuration</Button>
      </div>
    </div>
  );
};

// Main Workflow Builder Component
const WorkflowBuilderContent = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isNodePanelOpen, setIsNodePanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [isSaving, setIsSaving] = useState(false);

  const { fitView, getNodes, getEdges } = useReactFlow();
  const { publishEvent, subscribeToEvents } = useApix();

  // Subscribe to workflow events
  useEffect(() => {
    const unsubscribe = subscribeToEvents('workflow-events', (event) => {
      if (event.type === 'WORKFLOW_EXECUTION_STARTED') {
        setIsExecuting(true);
        setExecutionProgress(0);
      } else if (event.type === 'WORKFLOW_EXECUTION_COMPLETED') {
        setIsExecuting(false);
        setExecutionProgress(100);
      } else if (event.type === 'WORKFLOW_EXECUTION_FAILED') {
        setIsExecuting(false);
        setExecutionProgress(0);
      } else if (event.type === 'NODE_EXECUTION_STARTED') {
        // Update node status
        setNodes((nds) =>
          nds.map((node) =>
            node.id === event.nodeId
              ? { ...node, data: { ...node.data, status: 'running' } }
              : node
          )
        );
      } else if (event.type === 'NODE_EXECUTION_COMPLETED') {
        // Update node status
        setNodes((nds) =>
          nds.map((node) =>
            node.id === event.nodeId
              ? { ...node, data: { ...node.data, status: 'completed' } }
              : node
          )
        );
      }
    });

    return unsubscribe;
  }, [subscribeToEvents, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      const edge = {
        ...params,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          strokeWidth: 2,
          stroke: '#6366f1',
        },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type,
        status: 'idle',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const executeWorkflow = async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    setExecutionProgress(0);

    try {
      const workflowData = {
        name: workflowName,
        nodes: getNodes(),
        edges: getEdges(),
        variables: {},
        settings: {},
      };

      await publishEvent('workflow-events', {
        type: 'EXECUTE_WORKFLOW',
        data: workflowData,
      });

      // Simulate execution progress
      const interval = setInterval(() => {
        setExecutionProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

    } catch (error) {
      console.error('Workflow execution failed:', error);
      setIsExecuting(false);
      setExecutionProgress(0);
    }
  };

  const saveWorkflow = async () => {
    setIsSaving(true);
    try {
      const workflowData = {
        name: workflowName,
        nodes: getNodes(),
        edges: getEdges(),
        variables: {},
        settings: {},
      };

      await publishEvent('workflow-events', {
        type: 'SAVE_WORKFLOW',
        data: workflowData,
      });

      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsNodePanelOpen(true);
  };

  return (
    <div className={cn(
      "h-full w-full bg-gray-50 relative",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-lg font-semibold border-none shadow-none p-0 h-auto"
            />
            <Badge variant="secondary">Draft</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={saveWorkflow}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
            
            <Button
              onClick={executeWorkflow}
              disabled={isExecuting || nodes.length === 0}
              size="sm"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Execute
                </>
              )}
            </Button>
          </div>
        </div>
        
        {isExecuting && (
          <div className="px-4 pb-2">
            <Progress value={executionProgress} className="h-2" />
          </div>
        )}
      </div>

      {/* Node Palette */}
      <div className="absolute top-20 left-4 z-10">
        <Card className="w-64 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add Nodes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addNode('agent')}
              className="w-full justify-start"
            >
              <Bot className="w-4 h-4 mr-2" />
              Agent Node
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addNode('tool')}
              className="w-full justify-start"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Tool Node
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addNode('hybrid')}
              className="w-full justify-start"
            >
              <Zap className="w-4 h-4 mr-2" />
              Hybrid Node
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addNode('condition')}
              className="w-full justify-start"
            >
              <GitBranch className="w-4 h-4 mr-2" />
              Condition
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addNode('humanInput')}
              className="w-full justify-start"
            >
              <Users className="w-4 h-4 mr-2" />
              Human Input
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Flow Canvas */}
      <div className="h-full pt-20">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
        >
          <Controls className="bg-white shadow-lg border rounded-lg" />
          <MiniMap 
            className="bg-white shadow-lg border rounded-lg"
            nodeColor={(node) => {
              switch (node.type) {
                case 'agent': return '#3b82f6';
                case 'tool': return '#10b981';
                case 'hybrid': return '#8b5cf6';
                case 'condition': return '#f59e0b';
                case 'humanInput': return '#f97316';
                default: return '#6b7280';
              }
            }}
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          
          <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-lg border m-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Agents: {nodes.filter(n => n.type === 'agent').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Tools: {nodes.filter(n => n.type === 'tool').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Hybrid: {nodes.filter(n => n.type === 'hybrid').length}</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Configuration Panel */}
      <Sheet open={isNodePanelOpen} onOpenChange={setIsNodePanelOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>
              {selectedNode ? `Configure ${selectedNode.data.name}` : 'Node Configuration'}
            </SheetTitle>
          </SheetHeader>
          
          {selectedNode && (
            <div className="mt-6">
              {selectedNode.type === 'agent' && (
                <AgentConfigForm 
                  data={selectedNode.data} 
                  onSave={() => setIsNodePanelOpen(false)} 
                />
              )}
              {selectedNode.type === 'tool' && (
                <ToolConfigForm 
                  data={selectedNode.data} 
                  onSave={() => setIsNodePanelOpen(false)} 
                />
              )}
              {selectedNode.type === 'hybrid' && (
                <HybridConfigForm 
                  data={selectedNode.data} 
                  onSave={() => setIsNodePanelOpen(false)} 
                />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default function WorkflowBuilder() {
  return (
    <div className="h-screen w-full bg-white">
      <ReactFlowProvider>
        <WorkflowBuilderContent />
      </ReactFlowProvider>
    </div>
  );
}