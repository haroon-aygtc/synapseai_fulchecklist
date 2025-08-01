import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HumanInputNodeData {
  label: string;
  prompt: string;
  inputType: 'TEXT' | 'CHOICE' | 'FILE' | 'APPROVAL';
  status: 'idle' | 'running' | 'success' | 'error' | 'pending';
  config: {
    choices?: string[];
    defaultValue?: any;
    timeoutSeconds?: number;
    escalationUserId?: string;
    required?: boolean;
  };
}

function HumanInputNode({ data, selected }: NodeProps<HumanInputNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
      case 'pending':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
      case 'pending':
        return 'border-blue-500 bg-blue-50';
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getInputTypeColor = () => {
    switch (data.inputType) {
      case 'TEXT':
        return 'bg-blue-100 text-blue-800';
      case 'CHOICE':
        return 'bg-green-100 text-green-800';
      case 'FILE':
        return 'bg-purple-100 text-purple-800';
      case 'APPROVAL':
        return 'bg-orange-100 text-orange-800';
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
          <div className="p-1 bg-pink-500 rounded">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            <div className="text-xs text-gray-500">Human Input</div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-2">
          <Badge className={cn('text-xs', getInputTypeColor())}>
            {data.inputType}
          </Badge>

          {data.prompt && (
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-700">
                {data.prompt.length > 60 
                  ? `${data.prompt.slice(0, 60)}...` 
                  : data.prompt
                }
              </div>
            </div>
          )}

          {data.config.choices && data.config.choices.length > 0 && (
            <div className="text-xs text-gray-600">
              {data.config.choices.length} choices available
            </div>
          )}

          {data.config.timeoutSeconds && (
            <div className="text-xs text-gray-600">
              Timeout: {data.config.timeoutSeconds}s
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {data.config.required && (
              <Badge variant="outline" className="text-xs">
                Required
              </Badge>
            )}
            {data.config.escalationUserId && (
              <Badge variant="outline" className="text-xs">
                Escalation
              </Badge>
            )}
          </div>

          {data.status === 'pending' && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <AlertCircle className="h-3 w-3" />
              Awaiting human input
            </div>
          )}
        </div>
      </CardContent>

      {/* Approved path */}
      <Handle
        type="source"
        position={Position.Right}
        id="approved"
        style={{ top: '30%' }}
        className="w-3 h-3 !bg-green-500"
      />
      
      {/* Rejected/Timeout path */}
      <Handle
        type="source"
        position={Position.Right}
        id="rejected"
        style={{ top: '70%' }}
        className="w-3 h-3 !bg-red-500"
      />

      {/* Labels */}
      <div className="absolute -right-16 top-6 text-xs text-green-600 font-medium">
        Approved
      </div>
      <div className="absolute -right-16 bottom-6 text-xs text-red-600 font-medium">
        Rejected
      </div>
    </Card>
  );
}

export default memo(HumanInputNode);