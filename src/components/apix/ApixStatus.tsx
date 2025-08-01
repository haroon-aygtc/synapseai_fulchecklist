/**
 * APIX Connection Status Component
 * 
 * This component displays the current connection status of the APIX client.
 */

import React from 'react';
import { useApixStatus } from '@/lib/apix';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

interface ApixStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function ApixStatus({ showLabel = false, className = '' }: ApixStatusProps) {
  const status = useApixStatus();

  // Define status configurations
  const statusConfig = {
    connected: {
      icon: Wifi,
      label: 'Connected',
      variant: 'success' as const,
      tooltip: 'APIX connection established'
    },
    connecting: {
      icon: Loader2,
      label: 'Connecting',
      variant: 'warning' as const,
      tooltip: 'Establishing APIX connection...',
      className: 'animate-spin'
    },
    reconnecting: {
      icon: Loader2,
      label: 'Reconnecting',
      variant: 'warning' as const,
      tooltip: 'Attempting to reconnect APIX...',
      className: 'animate-spin'
    },
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      variant: 'outline' as const,
      tooltip: 'APIX connection lost'
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      variant: 'destructive' as const,
      tooltip: 'APIX connection error'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 ${className}`}>
            <Badge variant={config.variant} className="h-6 px-2 flex items-center gap-1">
              <Icon className={`h-3 w-3 ${config.className || ''}`} />
              {showLabel && <span className="text-xs">{config.label}</span>}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}