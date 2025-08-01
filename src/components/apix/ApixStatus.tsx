/**
 * APIX Connection Status Component
 * 
 * This component displays the current connection status of the APIX client.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  useApixConnection, 
  useApixMetrics, 
  useApixConnectionInfo,
  useApixContext
} from '@/lib/apix';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Clock, 
  Users, 
  MessageSquare, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface ApixStatusProps {
  className?: string;
  showDetailedMetrics?: boolean;
}

export default function ApixStatus({ 
  className = '', 
  showDetailedMetrics = true 
}: ApixStatusProps) {
  const { status, isConnected, connect, disconnect } = useApixConnection();
  const { latency } = useApixContext();
  const metrics = useApixMetrics();
  const connectionInfo = useApixConnectionInfo();
  const [autoReconnect, setAutoReconnect] = useState(true);

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'connecting':
      case 'reconnecting':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-50 border-green-200';
      case 'connecting':
      case 'reconnecting': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'disconnected': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-green-600';
    if (latency < 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleConnectionToggle = async () => {
    if (isConnected) {
      disconnect();
    } else {
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className={`bg-white ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            APIX Connection Status
          </CardTitle>
          <CardDescription>
            Real-time connection status and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Status */}
          <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <div className="font-semibold capitalize">{status}</div>
                  <div className="text-sm opacity-75">
                    {status === 'connected' && 'Connected to APIX server'}
                    {status === 'connecting' && 'Establishing connection...'}
                    {status === 'reconnecting' && `Reconnecting... (attempt ${connectionInfo.reconnectAttempts || 0})`}
                    {status === 'disconnected' && 'Not connected to APIX server'}
                    {status === 'error' && 'Connection error occurred'}
                  </div>
                </div>
              </div>
              <Button
                variant={isConnected ? 'destructive' : 'default'}
                size="sm"
                onClick={handleConnectionToggle}
                disabled={status === 'connecting' || status === 'reconnecting'}
              >
                {isConnected ? (
                  <>
                    <WifiOff className="h-4 w-4 mr-2" />
                    Disconnect
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Connection Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {connectionInfo.subscriptions || 0}
              </div>
              <div className="text-sm text-gray-600">Subscriptions</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {connectionInfo.queuedMessages || 0}
              </div>
              <div className="text-sm text-gray-600">Queued Messages</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${getLatencyColor(latency)}`}>
                {Math.round(latency)}ms
              </div>
              <div className="text-sm text-gray-600">Latency</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {connectionInfo.reconnectAttempts || 0}
              </div>
              <div className="text-sm text-gray-600">Reconnect Attempts</div>
            </div>
          </div>

          {/* Detailed Metrics */}
          {showDetailedMetrics && metrics && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">System Metrics</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Active Connections</span>
                    <span className="text-sm text-gray-600">{metrics.activeConnections}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Events/Second</span>
                    <span className="text-sm text-gray-600">{metrics.eventsPerSecond.toFixed(1)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Average Latency</span>
                    <span className={`text-sm ${getLatencyColor(metrics.averageLatency)}`}>
                      {Math.round(metrics.averageLatency)}ms
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Error Rate</span>
                    <span className={`text-sm ${metrics.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                      {(metrics.errorRate * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Events</span>
                    <span className="text-sm text-gray-600">{metrics.totalEvents}</span>
                  </div>
                  
                  {metrics.systemHealth && (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">CPU Usage</span>
                          <span className="text-sm text-gray-600">{metrics.systemHealth.cpu.toFixed(1)}%</span>
                        </div>
                        <Progress value={metrics.systemHealth.cpu} className="h-2" />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Memory Usage</span>
                          <span className="text-sm text-gray-600">{metrics.systemHealth.memory.toFixed(1)}%</span>
                        </div>
                        <Progress value={metrics.systemHealth.memory} className="h-2" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Uptime</span>
                        <span className="text-sm text-gray-600">
                          {formatUptime(metrics.systemHealth.uptime)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Events by Channel */}
              {Object.keys(metrics.eventsByChannel).length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-900">Events by Channel</h5>
                  <div className="space-y-1">
                    {Object.entries(metrics.eventsByChannel).map(([channel, count]) => (
                      <div key={channel} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{channel.replace('-', ' ')}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Socket Info */}
          {connectionInfo.socketId && (
            <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
              Socket ID: {connectionInfo.socketId}
              {connectionInfo.organizationId && (
                <span className="ml-4">Org: {connectionInfo.organizationId}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}