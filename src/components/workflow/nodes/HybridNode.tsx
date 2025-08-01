import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle, XCircle, Clock, Bot, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HybridNodeData {
  label: string;
  agentId?: string;
  toolIds?: string[];
  executionMode: 'agent-first' | 'tool-first' | 'parallel';
  status: 'idle' | 'running' | 'success' | 'error';
  config: {
    contextSharing?: boolean;
    memoryEnabled?: boolean;
    timeout?: number;
    fallbackMode?: string;
  };
}

function HybridNode({ data, selected }: NodeProps<HybridNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
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

  const getModeColor = () => {
    switch (data.executionMode) {
      case 'agent-first':
        return 'bg-blue-100 text-blue-800';
      case 'tool-first':
        return 'bg-yellow-100 text-yellow-800';
      case 'parallel':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className={cn(
      'min-w-[220px] transition-all duration-200',
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
          <div className="p-1 bg-purple-500 rounded">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            <div className="text-xs text-gray-500">Hybrid Node</div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-2">
          <Badge className={cn('text-xs', getModeColor())}>
            {data.executionMode.replace('-', ' ').toUpperCase()}
          </Badge>

          <div className="flex items-center gap-2">
            {data.agentId && (
              <div className="flex items-center gap-1">
                <Bot className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-gray-600">Agent</span>
              </div>
            )}
            {data.toolIds && data.toolIds.length > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span className="text-xs text-gray-600">{data.toolIds.length} Tools</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {data.config.contextSharing && (
              <Badge variant="outline" className="text-xs">
                Context Sharing
              </Badge>
            )}
            {data.config.memoryEnabled && (
              <Badge variant="outline" className="text-xs">
                Memory
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-green-500"
      />
    </Card>
  );
}

export default memo(HybridNode);