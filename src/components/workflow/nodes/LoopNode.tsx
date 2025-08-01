import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoopNodeData {
  label: string;
  loopType: 'while' | 'for' | 'forEach';
  condition?: string;
  maxIterations?: number;
  status: 'idle' | 'running' | 'success' | 'error';
  config: {
    breakCondition?: string;
    continueCondition?: string;
    timeout?: number;
    currentIteration?: number;
  };
}

function LoopNode({ data, selected }: NodeProps<LoopNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <RotateCcw className="h-3 w-3 text-gray-500" />;
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

  const getLoopTypeColor = () => {
    switch (data.loopType) {
      case 'while':
        return 'bg-blue-100 text-blue-800';
      case 'for':
        return 'bg-green-100 text-green-800';
      case 'forEach':
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
          <div className="p-1 bg-indigo-500 rounded">
            <RotateCcw className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            <div className="text-xs text-gray-500">Loop</div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-2">
          <Badge className={cn('text-xs', getLoopTypeColor())}>
            {data.loopType.toUpperCase()}
          </Badge>

          {data.maxIterations && (
            <div className="text-xs text-gray-600">
              Max: {data.maxIterations} iterations
            </div>
          )}

          {data.config.currentIteration !== undefined && data.status === 'running' && (
            <div className="text-xs text-blue-600">
              Current: {data.config.currentIteration}
            </div>
          )}

          {data.condition && (
            <div className="bg-gray-50 rounded p-2">
              <code className="text-xs text-gray-700 break-all">
                {data.condition.length > 40 
                  ? `${data.condition.slice(0, 40)}...` 
                  : data.condition
                }
              </code>
            </div>
          )}
        </div>
      </CardContent>

      {/* Continue loop */}
      <Handle
        type="source"
        position={Position.Right}
        id="continue"
        style={{ top: '30%' }}
        className="w-3 h-3 !bg-blue-500"
      />
      
      {/* Exit loop */}
      <Handle
        type="source"
        position={Position.Right}
        id="exit"
        style={{ top: '70%' }}
        className="w-3 h-3 !bg-green-500"
      />

      {/* Loop body */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="body"
        className="w-3 h-3 !bg-orange-500"
      />

      {/* Labels */}
      <div className="absolute -right-16 top-6 text-xs text-blue-600 font-medium">
        Continue
      </div>
      <div className="absolute -right-12 bottom-6 text-xs text-green-600 font-medium">
        Exit
      </div>
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-orange-600 font-medium">
        Body
      </div>
    </Card>
  );
}

export default memo(LoopNode);