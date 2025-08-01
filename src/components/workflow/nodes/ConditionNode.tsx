import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConditionNodeData {
  label: string;
  condition: string;
  evaluationType: 'JAVASCRIPT' | 'TEMPLATE' | 'RULE';
  status: 'idle' | 'running' | 'success' | 'error';
  config: {
    trueLabel?: string;
    falseLabel?: string;
    timeout?: number;
  };
}

function ConditionNode({ data, selected }: NodeProps<ConditionNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <GitBranch className="h-3 w-3 text-gray-500" />;
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
          <div className="p-1 bg-orange-500 rounded">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            <div className="text-xs text-gray-500">Condition</div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs">
            {data.evaluationType}
          </Badge>

          {data.condition && (
            <div className="bg-gray-50 rounded p-2">
              <code className="text-xs text-gray-700 break-all">
                {data.condition.length > 50 
                  ? `${data.condition.slice(0, 50)}...` 
                  : data.condition
                }
              </code>
            </div>
          )}
        </div>
      </CardContent>

      {/* True path */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%' }}
        className="w-3 h-3 !bg-green-500"
      />
      
      {/* False path */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%' }}
        className="w-3 h-3 !bg-red-500"
      />

      {/* Labels for outputs */}
      <div className="absolute -right-12 top-6 text-xs text-green-600 font-medium">
        {data.config.trueLabel || 'True'}
      </div>
      <div className="absolute -right-12 bottom-6 text-xs text-red-600 font-medium">
        {data.config.falseLabel || 'False'}
      </div>
    </Card>
  );
}

export default memo(ConditionNode);