import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, Globe, Calendar, Webhook, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TriggerNodeData {
  label: string;
  triggerType: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'EVENT' | 'API';
  status: 'idle' | 'running' | 'success' | 'error';
  config: {
    schedule?: string;
    webhookUrl?: string;
    eventType?: string;
    apiEndpoint?: string;
    enabled?: boolean;
  };
}

function TriggerNode({ data, selected }: NodeProps<TriggerNodeData>) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Play className="h-3 w-3 text-gray-500" />;
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

  const getTriggerIcon = () => {
    switch (data.triggerType) {
      case 'MANUAL':
        return <Play className="h-4 w-4 text-white" />;
      case 'SCHEDULED':
        return <Calendar className="h-4 w-4 text-white" />;
      case 'WEBHOOK':
        return <Webhook className="h-4 w-4 text-white" />;
      case 'EVENT':
        return <Clock className="h-4 w-4 text-white" />;
      case 'API':
        return <Globe className="h-4 w-4 text-white" />;
      default:
        return <Play className="h-4 w-4 text-white" />;
    }
  };

  const getTriggerTypeColor = () => {
    switch (data.triggerType) {
      case 'MANUAL':
        return 'bg-blue-100 text-blue-800';
      case 'SCHEDULED':
        return 'bg-green-100 text-green-800';
      case 'WEBHOOK':
        return 'bg-purple-100 text-purple-800';
      case 'EVENT':
        return 'bg-orange-100 text-orange-800';
      case 'API':
        return 'bg-pink-100 text-pink-800';
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
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 bg-green-500 rounded">
            {getTriggerIcon()}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            <div className="text-xs text-gray-500">Trigger</div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-2">
          <Badge className={cn('text-xs', getTriggerTypeColor())}>
            {data.triggerType}
          </Badge>

          {data.config.schedule && (
            <div className="text-xs text-gray-600">
              Schedule: {data.config.schedule}
            </div>
          )}

          {data.config.webhookUrl && (
            <div className="text-xs text-gray-600 truncate">
              Webhook: {data.config.webhookUrl}
            </div>
          )}

          {data.config.eventType && (
            <div className="text-xs text-gray-600">
              Event: {data.config.eventType}
            </div>
          )}

          {data.config.apiEndpoint && (
            <div className="text-xs text-gray-600 truncate">
              API: {data.config.apiEndpoint}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Badge 
              variant={data.config.enabled ? "default" : "secondary"} 
              className="text-xs"
            >
              {data.config.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
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

export default memo(TriggerNode);