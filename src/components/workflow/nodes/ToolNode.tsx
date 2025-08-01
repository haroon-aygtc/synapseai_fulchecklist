import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle, XCircle, Clock, Database, Globe, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolNodeData {
  label: string;
  toolId?: string;
  toolType?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  config: {
    parameters?: Record<string, any>;
    authentication?: Record<string, any>;
    timeout?: number;
    retryCount?: number;
  };
}

function ToolNode({ data, selected }: NodeProps<ToolNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Zap className="h-3 w-3 text-gray-500" />;
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

  const getToolIcon = () => {
    switch (data.toolType) {
      case 'database':
        return <Database className="h-4 w-4 text-white" />;
      case 'api':
        return <Globe className="h-4 w-4 text-white" />;
      case 'function':
        return <Code className="h-4 w-4 text-white" />;
      default:
        return <Zap className="h-4 w-4 text-white" />;
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
          <div className="p-1 bg-yellow-500 rounded">
            {getToolIcon()}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            {data.toolType && (
              <div className="text-xs text-gray-500 capitalize">{data.toolType}</div>
            )}
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-1">
          {data.toolId && (
            <Badge variant="secondary" className="text-xs">
              ID: {data.toolId.slice(-8)}
            </Badge>
          )}
        </div>

        {data.config.timeout && (
          <div className="mt-2 text-xs text-gray-600">
            Timeout: {data.config.timeout}ms
          </div>
        )}

        {data.config.retryCount && (
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">
              Retries: {data.config.retryCount}
            </Badge>
          </div>
        )}

        {data.config.authentication && (
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">
              Authenticated
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

export default memo(ToolNode);