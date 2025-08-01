/**
 * APIX Connection Manager Component
 * 
 * Provides UI controls for managing APIX connections, including connection status,
 * reconnection options, and connection details.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useApixContext,
  useApixConnectionInfo,
  useApixMetrics
} from '@/lib/apix';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Settings, 
  Activity, 
  Clock,
  Users,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
  Zap,
  Shield,
  Globe
} from 'lucide-react';

interface ConnectionSettings {
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  heartbeatInterval: number;
  messageQueueSize: number;
  compressionThreshold: number;
}

interface ApixConnectionManagerProps {
  className?: string;
  showAdvancedSettings?: boolean;
}

export default function ApixConnectionManager({ 
  className = '',
  showAdvancedSettings = true
}: ApixConnectionManagerProps) {
  const { client, status, isConnected, connect, disconnect, latency } = useApixContext();
  const connectionInfo = useApixConnectionInfo();
  const metrics = useApixMetrics();
  
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>({
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectInterval: 5000,
    heartbeatInterval: 30000,
    messageQueueSize: 1000,
    compressionThreshold: 1024
  });
  
  const [authToken, setAuthToken] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<Array<{
    timestamp: Date;
    event: string;
    details?: string;
  }>>([]);

  // Track connection events
  useEffect(() => {
    const addConnectionEvent = (event: string, details?: string) => {
      setConnectionHistory(prev => [
        { timestamp: new Date(), event, details },
        ...prev.slice(0, 49) // Keep last 50 events
      ]);
    };

    // Add event when status changes
    addConnectionEvent(`Status changed to: ${status}`);
  }, [status]);

  const handleConnect = async () => {
    if (isConnected) return;
    
    setIsConnecting(true);
    try {
      await connect(authToken || undefined, organizationId || undefined);
      setConnectionHistory(prev => [
        { timestamp: new Date(), event: 'Connection successful' },
        ...prev.slice(0, 49)
      ]);
    } catch (error) {
      setConnectionHistory(prev => [
        { 
          timestamp: new Date(), 
          event: 'Connection failed', 
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        ...prev.slice(0, 49)
      ]);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnectionHistory(prev => [
      { timestamp: new Date(), event: 'Manual disconnect' },
      ...prev.slice(0, 49)
    ]);
  };

  const handleReconnect = async () => {
    if (isConnected) {
      handleDisconnect();
      // Wait a moment before reconnecting
      setTimeout(() => {
        handleConnect();
      }, 1000);
    } else {
      handleConnect();
    }
  };

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

  const getConnectionQuality = () => {
    if (!isConnected) return { label: 'Disconnected', color: 'text-gray-500' };
    
    const errorRate = metrics?.errorRate || 0;
    const avgLatency = latency;
    
    if (errorRate > 0.1 || avgLatency > 200) {
      return { label: 'Poor', color: 'text-red-500' };
    } else if (errorRate > 0.05 || avgLatency > 100) {
      return { label: 'Fair', color: 'text-yellow-500' };
    } else if (avgLatency > 50) {
      return { label: 'Good', color: 'text-blue-500' };
    } else {
      return { label: 'Excellent', color: 'text-green-500' };
    }
  };

  const connectionQuality = getConnectionQuality();

  return (
    <div className={`bg-white ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            APIX Connection Manager
          </CardTitle>
          <CardDescription>
            Manage your APIX connection settings and monitor connection health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="status" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="connection">Connection</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Status Tab */}
            <TabsContent value="status" className="space-y-4">
              {/* Main Status Card */}
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
                  <div className="text-right">
                    <div className={`font-semibold ${connectionQuality.color}`}>
                      {connectionQuality.label}
                    </div>
                    <div className="text-sm opacity-75">Quality</div>
                  </div>
                </div>
              </div>

              {/* Connection Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {connectionInfo.subscriptions || 0}
                    </div>
                    <div className="text-sm text-gray-600">Active Subscriptions</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {connectionInfo.queuedMessages || 0}
                    </div>
                    <div className="text-sm text-gray-600">Queued Messages</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className={`text-2xl font-bold ${getLatencyColor(latency)}`}>
                      {Math.round(latency)}ms
                    </div>
                    <div className="text-sm text-gray-600">Latency</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {connectionInfo.reconnectAttempts || 0}
                    </div>
                    <div className="text-sm text-gray-600">Reconnect Attempts</div>
                  </CardContent>
                </Card>
              </div>

              {/* System Metrics */}
              {metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">System Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Connection Details */}
              {connectionInfo.socketId && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="font-mono text-xs">
                    Socket ID: {connectionInfo.socketId}
                    {connectionInfo.organizationId && (
                      <span className="ml-4">Organization: {connectionInfo.organizationId}</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Connection Tab */}
            <TabsContent value="connection" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Connection Controls</CardTitle>
                  <CardDescription>
                    Manage your APIX connection and authentication
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="auth-token">Authentication Token</Label>
                      <Input
                        id="auth-token"
                        type="password"
                        value={authToken}
                        onChange={(e) => setAuthToken(e.target.value)}
                        placeholder="Enter JWT token"
                        disabled={isConnected}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="org-id">Organization ID</Label>
                      <Input
                        id="org-id"
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                        placeholder="Enter organization ID"
                        disabled={isConnected}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isConnected ? (
                      <Button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="flex items-center gap-2"
                      >
                        {isConnecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wifi className="h-4 w-4" />
                        )}
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleDisconnect}
                        variant="destructive"
                        className="flex items-center gap-2"
                      >
                        <WifiOff className="h-4 w-4" />
                        Disconnect
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleReconnect}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              {showAdvancedSettings && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Connection Settings</CardTitle>
                    <CardDescription>
                      Configure advanced connection parameters
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Reconnect</Label>
                        <div className="text-sm text-gray-600">
                          Automatically reconnect when connection is lost
                        </div>
                      </div>
                      <Switch
                        checked={connectionSettings.autoReconnect}
                        onCheckedChange={(checked) => 
                          setConnectionSettings(prev => ({ ...prev, autoReconnect: checked }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-reconnect">Max Reconnect Attempts</Label>
                        <Input
                          id="max-reconnect"
                          type="number"
                          value={connectionSettings.maxReconnectAttempts}
                          onChange={(e) => 
                            setConnectionSettings(prev => ({ 
                              ...prev, 
                              maxReconnectAttempts: Number(e.target.value) 
                            }))
                          }
                          min="1"
                          max="100"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reconnect-interval">Reconnect Interval (ms)</Label>
                        <Input
                          id="reconnect-interval"
                          type="number"
                          value={connectionSettings.reconnectInterval}
                          onChange={(e) => 
                            setConnectionSettings(prev => ({ 
                              ...prev, 
                              reconnectInterval: Number(e.target.value) 
                            }))
                          }
                          min="1000"
                          max="60000"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="heartbeat-interval">Heartbeat Interval (ms)</Label>
                        <Input
                          id="heartbeat-interval"
                          type="number"
                          value={connectionSettings.heartbeatInterval}
                          onChange={(e) => 
                            setConnectionSettings(prev => ({ 
                              ...prev, 
                              heartbeatInterval: Number(e.target.value) 
                            }))
                          }
                          min="5000"
                          max="120000"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="queue-size">Message Queue Size</Label>
                        <Input
                          id="queue-size"
                          type="number"
                          value={connectionSettings.messageQueueSize}
                          onChange={(e) => 
                            setConnectionSettings(prev => ({ 
                              ...prev, 
                              messageQueueSize: Number(e.target.value) 
                            }))
                          }
                          min="100"
                          max="10000"
                        />
                      </div>
                    </div>

                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        Changes to connection settings will take effect on the next connection attempt.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Connection History</CardTitle>
                  <CardDescription>
                    Recent connection events and status changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {connectionHistory.map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-start justify-between p-2 border rounded text-sm"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{entry.event}</div>
                            {entry.details && (
                              <div className="text-xs text-gray-600 mt-1">
                                {entry.details}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 ml-2">
                            {entry.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                      {connectionHistory.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          No connection history available
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}