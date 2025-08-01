import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Activity,
  Zap,
  Timer,
  TrendingUp
} from 'lucide-react';
import { useEventSystemFromContext } from '../context/event-context';
import { useToolExecutionMonitoring } from '../hooks/event-hooks';

export interface ToolExecutionMonitorProps {
  toolId?: string;
  className?: string;
  showMetrics?: boolean;
  showLogs?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface ExecutionMetrics {
  totalExecutions: number;
  activeExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  executionsPerMinute: number;
}

export function ToolExecutionMonitor({
  toolId,
  className = '',
  showMetrics = true,
  showLogs = true,
  autoRefresh = true,
  refreshInterval = 5000
}: ToolExecutionMonitorProps) {
  const eventSystem = useEventSystemFromContext();
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ExecutionMetrics>({
    totalExecutions: 0,
    activeExecutions: 0,
    completedExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    successRate: 100,
    executionsPerMinute: 0
  });
  const [logs, setLogs] = useState<Array<{
    id: string;
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    message: string;
    executionId?: string;
    toolId?: string;
  }>>([]);

  const metricsIntervalRef = useRef<NodeJS.Timeout>();

  const {
    executions,
    activeExecutions,
    completedExecutions,
    failedExecutions,
    onExecutionStart,
    onExecutionProgress,
    onExecutionComplete,
    onExecutionError
  } = useToolExecutionMonitoring(eventSystem, toolId);

  // Calculate metrics
  useEffect(() => {
    const calculateMetrics = () => {
      const total = executions.size;
      const active = activeExecutions.length;
      const completed = completedExecutions.length;
      const failed = failedExecutions.length;
      
      const completedWithTimes = completedExecutions.filter(e => e.startedAt && e.completedAt);
      const avgTime = completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, e) => 
            sum + (e.completedAt.getTime() - e.startedAt.getTime()), 0
          ) / completedWithTimes.length
        : 0;

      const successRate = total > 0 ? (completed / total) * 100 : 100;

      // Calculate executions per minute (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentExecutions = Array.from(executions.values())
        .filter(e => e.startedAt && e.startedAt > fiveMinutesAgo);
      const executionsPerMinute = recentExecutions.length / 5;

      setMetrics({
        totalExecutions: total,
        activeExecutions: active,
        completedExecutions: completed,
        failedExecutions: failed,
        averageExecutionTime: avgTime,
        successRate,
        executionsPerMinute
      });
    };

    calculateMetrics();

    if (autoRefresh) {
      metricsIntervalRef.current = setInterval(calculateMetrics, refreshInterval);
    }

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [executions, activeExecutions, completedExecutions, failedExecutions, autoRefresh, refreshInterval]);

  // Set up event listeners
  useEffect(() => {
    const unsubscribers = [
      onExecutionStart((data) => {
        setLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          message: `Tool execution started: ${data.toolId}`,
          executionId: data.executionId,
          toolId: data.toolId
        }]);
      }),

      onExecutionProgress((data) => {
        setLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          message: `Tool execution progress: ${data.progress}%`,
          executionId: data.executionId,
          toolId: data.toolId
        }]);
      }),

      onExecutionComplete((data) => {
        setLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'info',
          message: `Tool execution completed successfully: ${data.toolId}`,
          executionId: data.executionId,
          toolId: data.toolId
        }]);
      }),

      onExecutionError((data) => {
        setLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          level: 'error',
          message: `Tool execution failed: ${data.error}`,
          executionId: data.executionId,
          toolId: data.toolId
        }]);
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onExecutionStart, onExecutionProgress, onExecutionComplete, onExecutionError]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'default',
      completed: 'secondary',
      failed: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const selectedExecutionData = selectedExecution ? executions.get(selectedExecution) : null;

  return (
    <div className={`bg-white space-y-6 ${className}`}>
      {showMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Executions</p>
                  <p className="text-2xl font-bold">{metrics.totalExecutions}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.activeExecutions}</p>
                </div>
                <Zap className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.successRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold">{formatDuration(metrics.averageExecutionTime)}</p>
                </div>
                <Timer className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active">Active ({activeExecutions.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedExecutions.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failedExecutions.length})</TabsTrigger>
          <TabsTrigger value="all">All ({executions.size})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <ScrollArea className="h-96">
            {activeExecutions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No active executions
              </div>
            ) : (
              <div className="space-y-2">
                {activeExecutions.map((execution) => (
                  <Card 
                    key={execution.id}
                    className={`cursor-pointer transition-colors ${
                      selectedExecution === execution.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedExecution(execution.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(execution.status)}
                          <div>
                            <p className="font-medium">{execution.toolId}</p>
                            <p className="text-sm text-gray-500">ID: {execution.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(execution.status)}
                          <p className="text-sm text-gray-500 mt-1">
                            {execution.startedAt?.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {execution.progress !== undefined && (
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{execution.progress}%</span>
                          </div>
                          <Progress value={execution.progress} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <ScrollArea className="h-96">
            {completedExecutions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No completed executions
              </div>
            ) : (
              <div className="space-y-2">
                {completedExecutions.map((execution) => (
                  <Card 
                    key={execution.id}
                    className={`cursor-pointer transition-colors ${
                      selectedExecution === execution.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedExecution(execution.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(execution.status)}
                          <div>
                            <p className="font-medium">{execution.toolId}</p>
                            <p className="text-sm text-gray-500">ID: {execution.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(execution.status)}
                          <p className="text-sm text-gray-500 mt-1">
                            Duration: {formatDuration(
                              execution.completedAt?.getTime() - execution.startedAt?.getTime()
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="failed" className="space-y-4">
          <ScrollArea className="h-96">
            {failedExecutions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No failed executions
              </div>
            ) : (
              <div className="space-y-2">
                {failedExecutions.map((execution) => (
                  <Card 
                    key={execution.id}
                    className={`cursor-pointer transition-colors ${
                      selectedExecution === execution.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedExecution(execution.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(execution.status)}
                          <div>
                            <p className="font-medium">{execution.toolId}</p>
                            <p className="text-sm text-gray-500">ID: {execution.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(execution.status)}
                          <p className="text-sm text-gray-500 mt-1">
                            {execution.failedAt?.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {execution.error && (
                        <Alert className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            {execution.error}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <ScrollArea className="h-96">
            {executions.size === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No executions found
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from(executions.values())
                  .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0))
                  .map((execution) => (
                    <Card 
                      key={execution.id}
                      className={`cursor-pointer transition-colors ${
                        selectedExecution === execution.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedExecution(execution.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(execution.status)}
                            <div>
                              <p className="font-medium">{execution.toolId}</p>
                              <p className="text-sm text-gray-500">ID: {execution.id}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(execution.status)}
                            <p className="text-sm text-gray-500 mt-1">
                              {execution.startedAt?.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {selectedExecutionData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Execution Details</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedExecution(null)}
              >
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Tool ID</p>
                <p className="font-mono text-sm">{selectedExecutionData.toolId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Execution ID</p>
                <p className="font-mono text-sm">{selectedExecutionData.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                {getStatusBadge(selectedExecutionData.status)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Started At</p>
                <p className="text-sm">{selectedExecutionData.startedAt?.toLocaleString()}</p>
              </div>
            </div>

            {selectedExecutionData.input && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Input</p>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-32">
                  {JSON.stringify(selectedExecutionData.input, null, 2)}
                </pre>
              </div>
            )}

            {selectedExecutionData.output && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Output</p>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-32">
                  {JSON.stringify(selectedExecutionData.output, null, 2)}
                </pre>
              </div>
            )}

            {selectedExecutionData.error && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {selectedExecutionData.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {showLogs && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No logs available
                </div>
              ) : (
                <div className="space-y-2">
                  {logs
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded text-sm ${
                          log.level === 'error'
                            ? 'bg-red-50 text-red-800'
                            : log.level === 'warning'
                            ? 'bg-yellow-50 text-yellow-800'
                            : 'bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span>{log.message}</span>
                          <span className="text-xs opacity-75">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        {log.executionId && (
                          <p className="text-xs opacity-75 mt-1">
                            Execution: {log.executionId}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}