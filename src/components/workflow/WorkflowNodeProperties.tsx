import React, { useState } from 'react';
import { Node } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Settings, Code, Database, Zap, Bot, User, GitBranch } from 'lucide-react';
import { NodeType } from '@/lib/workflows/types';
import { cn } from '@/lib/utils';

interface WorkflowNodePropertiesProps {
  node: Node;
  onUpdate: (updates: any) => void;
  onClose: () => void;
}

export default function WorkflowNodeProperties({
  node,
  onUpdate,
  onClose
}: WorkflowNodePropertiesProps) {
  const [activeTab, setActiveTab] = useState('general');

  const getNodeIcon = () => {
    switch (node.type) {
      case NodeType.AGENT:
        return <Bot className="h-4 w-4" />;
      case NodeType.TOOL:
        return <Zap className="h-4 w-4" />;
      case NodeType.CONDITION:
        return <GitBranch className="h-4 w-4" />;
      case NodeType.HUMAN_INPUT:
        return <User className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const handleDataUpdate = (path: string, value: any) => {
    const pathArray = path.split('.');
    const updatedData = { ...node.data };
    
    let current = updatedData;
    for (let i = 0; i < pathArray.length - 1; i++) {
      if (!current[pathArray[i]]) {
        current[pathArray[i]] = {};
      }
      current = current[pathArray[i]];
    }
    current[pathArray[pathArray.length - 1]] = value;
    
    onUpdate({ data: updatedData });
  };

  const renderGeneralProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="node-label">Label</Label>
        <Input
          id="node-label"
          value={node.data.label || ''}
          onChange={(e) => handleDataUpdate('label', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="node-description">Description</Label>
        <Textarea
          id="node-description"
          value={node.data.description || ''}
          onChange={(e) => handleDataUpdate('description', e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <Label>Node Type</Label>
        <div className="flex items-center gap-2 mt-1">
          {getNodeIcon()}
          <Badge variant="secondary">{node.type}</Badge>
        </div>
      </div>

      <div>
        <Label>Position</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div>
            <Label htmlFor="pos-x" className="text-xs">X</Label>
            <Input
              id="pos-x"
              type="number"
              value={node.position.x}
              onChange={(e) => onUpdate({ position: { ...node.position, x: parseInt(e.target.value) } })}
            />
          </div>
          <div>
            <Label htmlFor="pos-y" className="text-xs">Y</Label>
            <Input
              id="pos-y"
              type="number"
              value={node.position.y}
              onChange={(e) => onUpdate({ position: { ...node.position, y: parseInt(e.target.value) } })}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderAgentProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="agent-id">Agent ID</Label>
        <Select
          value={node.data.config?.agentId || ''}
          onValueChange={(value) => handleDataUpdate('config.agentId', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent-1">Customer Support Agent</SelectItem>
            <SelectItem value="agent-2">Data Analysis Agent</SelectItem>
            <SelectItem value="agent-3">Content Creator Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          value={node.data.config?.systemPrompt || ''}
          onChange={(e) => handleDataUpdate('config.systemPrompt', e.target.value)}
          rows={4}
          placeholder="Enter system prompt for the agent..."
        />
      </div>

      <div>
        <Label htmlFor="model">Model</Label>
        <Select
          value={node.data.config?.model || ''}
          onValueChange={(value) => handleDataUpdate('config.model', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select model" />
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
        <Label htmlFor="temperature">Temperature</Label>
        <Input
          id="temperature"
          type="number"
          min="0"
          max="2"
          step="0.1"
          value={node.data.config?.temperature || 0.7}
          onChange={(e) => handleDataUpdate('config.temperature', parseFloat(e.target.value))}
        />
      </div>

      <div>
        <Label htmlFor="max-tokens">Max Tokens</Label>
        <Input
          id="max-tokens"
          type="number"
          value={node.data.config?.maxTokens || 1000}
          onChange={(e) => handleDataUpdate('config.maxTokens', parseInt(e.target.value))}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="memory-enabled"
          checked={node.data.config?.memoryEnabled || false}
          onCheckedChange={(checked) => handleDataUpdate('config.memoryEnabled', checked)}
        />
        <Label htmlFor="memory-enabled">Enable Memory</Label>
      </div>
    </div>
  );

  const renderToolProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="tool-id">Tool ID</Label>
        <Select
          value={node.data.config?.toolId || ''}
          onValueChange={(value) => handleDataUpdate('config.toolId', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a tool" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tool-1">Email Sender</SelectItem>
            <SelectItem value="tool-2">Database Query</SelectItem>
            <SelectItem value="tool-3">API Caller</SelectItem>
            <SelectItem value="tool-4">File Processor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="tool-type">Tool Type</Label>
        <Select
          value={node.data.config?.toolType || ''}
          onValueChange={(value) => handleDataUpdate('config.toolType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select tool type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="api">API Call</SelectItem>
            <SelectItem value="database">Database</SelectItem>
            <SelectItem value="function">Function</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="timeout">Timeout (ms)</Label>
        <Input
          id="timeout"
          type="number"
          value={node.data.config?.timeout || 30000}
          onChange={(e) => handleDataUpdate('config.timeout', parseInt(e.target.value))}
        />
      </div>

      <div>
        <Label htmlFor="retry-count">Retry Count</Label>
        <Input
          id="retry-count"
          type="number"
          min="0"
          max="5"
          value={node.data.config?.retryCount || 0}
          onChange={(e) => handleDataUpdate('config.retryCount', parseInt(e.target.value))}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="auth-required"
          checked={node.data.config?.authRequired || false}
          onCheckedChange={(checked) => handleDataUpdate('config.authRequired', checked)}
        />
        <Label htmlFor="auth-required">Authentication Required</Label>
      </div>
    </div>
  );

  const renderConditionProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="condition">Condition</Label>
        <Textarea
          id="condition"
          value={node.data.config?.condition || ''}
          onChange={(e) => handleDataUpdate('config.condition', e.target.value)}
          rows={3}
          placeholder="Enter condition expression..."
        />
      </div>

      <div>
        <Label htmlFor="evaluation-type">Evaluation Type</Label>
        <Select
          value={node.data.config?.evaluationType || 'JAVASCRIPT'}
          onValueChange={(value) => handleDataUpdate('config.evaluationType', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="JAVASCRIPT">JavaScript</SelectItem>
            <SelectItem value="TEMPLATE">Template</SelectItem>
            <SelectItem value="RULE">Rule Engine</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="true-label">True Path Label</Label>
        <Input
          id="true-label"
          value={node.data.config?.trueLabel || 'True'}
          onChange={(e) => handleDataUpdate('config.trueLabel', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="false-label">False Path Label</Label>
        <Input
          id="false-label"
          value={node.data.config?.falseLabel || 'False'}
          onChange={(e) => handleDataUpdate('config.falseLabel', e.target.value)}
        />
      </div>
    </div>
  );

  const renderHumanInputProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          value={node.data.config?.prompt || ''}
          onChange={(e) => handleDataUpdate('config.prompt', e.target.value)}
          rows={3}
          placeholder="Enter prompt for human input..."
        />
      </div>

      <div>
        <Label htmlFor="input-type">Input Type</Label>
        <Select
          value={node.data.config?.inputType || 'TEXT'}
          onValueChange={(value) => handleDataUpdate('config.inputType', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TEXT">Text</SelectItem>
            <SelectItem value="CHOICE">Choice</SelectItem>
            <SelectItem value="FILE">File</SelectItem>
            <SelectItem value="APPROVAL">Approval</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="timeout-seconds">Timeout (seconds)</Label>
        <Input
          id="timeout-seconds"
          type="number"
          value={node.data.config?.timeoutSeconds || 300}
          onChange={(e) => handleDataUpdate('config.timeoutSeconds', parseInt(e.target.value))}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="required"
          checked={node.data.config?.required || false}
          onCheckedChange={(checked) => handleDataUpdate('config.required', checked)}
        />
        <Label htmlFor="required">Required</Label>
      </div>
    </div>
  );

  const renderAdvancedProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="retry-config">Retry Configuration</Label>
        <div className="space-y-2 mt-2">
          <div>
            <Label htmlFor="max-retries" className="text-xs">Max Retries</Label>
            <Input
              id="max-retries"
              type="number"
              min="0"
              max="10"
              value={node.data.retryConfig?.maxRetries || 0}
              onChange={(e) => handleDataUpdate('retryConfig.maxRetries', parseInt(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="retry-delay" className="text-xs">Retry Delay (ms)</Label>
            <Input
              id="retry-delay"
              type="number"
              value={node.data.retryConfig?.retryDelay || 1000}
              onChange={(e) => handleDataUpdate('retryConfig.retryDelay', parseInt(e.target.value))}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="exponential-backoff"
              checked={node.data.retryConfig?.exponentialBackoff || false}
              onCheckedChange={(checked) => handleDataUpdate('retryConfig.exponentialBackoff', checked)}
            />
            <Label htmlFor="exponential-backoff" className="text-xs">Exponential Backoff</Label>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <Label htmlFor="fallback-config">Fallback Configuration</Label>
        <div className="space-y-2 mt-2">
          <div>
            <Label htmlFor="fallback-action" className="text-xs">Fallback Action</Label>
            <Select
              value={node.data.fallbackConfig?.fallbackAction || 'FAIL_WORKFLOW'}
              onValueChange={(value) => handleDataUpdate('fallbackConfig.fallbackAction', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SKIP">Skip Node</SelectItem>
                <SelectItem value="RETRY">Retry</SelectItem>
                <SelectItem value="FAIL_WORKFLOW">Fail Workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <Label htmlFor="node-timeout">Node Timeout (ms)</Label>
        <Input
          id="node-timeout"
          type="number"
          value={node.data.timeoutMs || 60000}
          onChange={(e) => handleDataUpdate('timeoutMs', parseInt(e.target.value))}
        />
      </div>
    </div>
  );

  const renderTypeSpecificProperties = () => {
    switch (node.type) {
      case NodeType.AGENT:
        return renderAgentProperties();
      case NodeType.TOOL:
        return renderToolProperties();
      case NodeType.CONDITION:
        return renderConditionProperties();
      case NodeType.HUMAN_INPUT:
        return renderHumanInputProperties();
      default:
        return <div className="text-sm text-gray-500">No specific properties for this node type.</div>;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getNodeIcon()}
            Node Properties
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="specific">Specific</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="general" className="mt-0">
              {renderGeneralProperties()}
            </TabsContent>

            <TabsContent value="specific" className="mt-0">
              {renderTypeSpecificProperties()}
            </TabsContent>

            <TabsContent value="advanced" className="mt-0">
              {renderAdvancedProperties()}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}