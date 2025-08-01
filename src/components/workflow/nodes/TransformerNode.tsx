import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransformerNodeData {
  label: string;
  transformationType: 'JAVASCRIPT' | 'TEMPLATE' | 'MAPPING' | 'FILTER';
  code?: string;
  template?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  config: {
    inputSchema?: any;
    outputSchema?: any;
    timeout?: number;
    errorHandling?: 'SKIP' | 'FAIL' | 'DEFAULT';
  };
}

function TransformerNode({ data, selected }: NodeProps<TransformerNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Code className="h-3 w-3 text-gray-500" />;
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

  const getTransformationIcon = () => {
    switch (data.transformationType) {
      case 'JAVASCRIPT':
        return <Code className="h-4 w-4 text-white" />;
      case 'TEMPLATE':
        return <Code className="h-4 w-4 text-white" />;
      case 'MAPPING':
        return <Code className="h-4 w-4 text-white" />;
      case 'FILTER':
        return <Filter className="h-4 w-4 text-white" />;
      default:
        return <Code className="h-4 w-4 text-white" />;
    }
  };

  const getTransformationTypeColor = () => {
    switch (data.transformationType) {
      case 'JAVASCRIPT':
        return 'bg-yellow-100 text-yellow-800';
      case 'TEMPLATE':
        return 'bg-blue-100 text-blue-800';
      case 'MAPPING':
        return 'bg-green-100 text-green-800';
      case 'FILTER':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          <div className="p-1 bg-teal-500 rounded">
            {getTransformationIcon()}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            <div className="text-xs text-gray-500">Transformer</div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-2">
          <Badge className={cn('text-xs', getTransformationTypeColor())}>
            {data.transformationType}
          </Badge>

          {data.code && (
            <div className="bg-gray-50 rounded p-2">
              <code className="text-xs text-gray-700 break-all">
                {data.code.length > 50 
                  ? `${data.code.slice(0, 50)}...` 
                  : data.code
                }
              </code>
            </div>
          )}

          {data.template && (
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-700">
                {data.template.length > 50 
                  ? `${data.template.slice(0, 50)}...` 
                  : data.template
                }
              </div>
            </div>
          )}

          {data.config.timeout && (
            <div className="text-xs text-gray-600">
              Timeout: {data.config.timeout}ms
            </div>
          )}

          {data.config.errorHandling && (
            <Badge variant="outline" className="text-xs">
              On Error: {data.config.errorHandling}
            </Badge>
          )}
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

export default memo(TransformerNode);