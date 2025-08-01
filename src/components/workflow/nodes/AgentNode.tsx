import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Settings, Play, Pause, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentNodeData {
  label: string;
  agentId?: string;
  agentType?: string;
  model?: string;
  provider?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  config: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: string[];
    memoryEnabled?: boolean;
  };
}

function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Bot className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'border-blue-500 bg-blue-50';
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  return (
    <Card className={cn(
      'min-w-[200px] transition-all duration-200',
      getStatusColor(),
      selected && 'ring-2 ring-blue-500 ring-offset-2'
    )}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-500"
      />
      
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-blue-500 rounded">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            {data.agentType && (
              <div className="text-xs text-gray-500">{data.agentType}</div>
            )}
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-1">
          {data.model && (
            <Badge variant="secondary" className="text-xs">
              {data.model}
            </Badge>
          )}
          {data.provider && (
            <Badge variant="outline" className="text-xs ml-1">
              {data.provider}
            </Badge>
          )}
        </div>

        {data.config.tools && data.config.tools.length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            Tools: {data.config.tools.length}
          </div>
        )}

        {data.config.memoryEnabled && (
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">
              Memory Enabled
            </Badge>
          </div>
        )}
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-green-500"
      />
    </Card>
  );
}

export default memo(AgentNode);