import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar,
  Clock,
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
  CheckCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import { workflowService } from '@/lib/services/workflow-service';
import { useApixEvents, APIX_CHANNELS } from '@/lib/apix';
import { cn } from '@/lib/utils';

interface WorkflowLogsProps {
  workflowId: string;
  executionId?: string;
  className?: string;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  nodeId?: string;
  nodeName?: string;
  executionId?: string;
  metadata?: Record<string, any>;
  source?: string;
  duration?: number;
  stackTrace?: string;
}

interface LogFilters {
  level: string[];
  nodeId: string[];
  search: string;
  dateRange: {
    start?: Date;
    end?: Date;
  };
  executionId?: string;
}

export default function WorkflowLogs({ workflowId, executionId, className = '' }: WorkflowLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<LogFilters>({
    level: [],
    nodeId: [],
    search: '',
    dateRange: {},
    executionId
  });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [availableNodes, setAvailableNodes] = useState<{ id: string; name: string }[]>([]);

  // Subscribe to real-time log events
  const logEvents = useApixEvents({
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    filters: { workflowId, type: 'WORKFLOW_LOG' }
  });

  useEffect(() => {
    loadLogs();
    loadAvailableNodes();
  }, [workflowId, executionId]);

  useEffect(() => {
    // Add new log events in real-time
    logEvents.forEach(event => {
      if (event.type === 'WORKFLOW_LOG' && event.data) {
        const newLog: LogEntry = {
          id: event.id,
          timestamp: new Date(event.metadata.timestamp),
          level: event.data.level,
          message: event.data.message,
          nodeId: event.data.nodeId,
          nodeName: event.data.nodeName,
          executionId: event.data.executionId,
          metadata: event.data.metadata,
          source: event.data.source,
          duration: event.data.duration,
          stackTrace: event.data.stackTrace
        };

        setLogs(prev => [newLog, ...prev]);
      }
    });
  }, [logEvents]);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        handleRefresh();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadLogs = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setIsLoading(true);
    
    try {
      const response = await workflowService.getWorkflowLogs(workflowId, {
        page: pageNum,
        limit: 50,
        executionId: filters.executionId
      });

      const transformedLogs: LogEntry[] = response.logs.map(log => ({
        id: log.id,
        timestamp: new Date(log.timestamp),
        level: log.level.toUpperCase() as LogEntry['level'],
        message: log.message,
        nodeId: log.nodeId,
        nodeName: log.metadata?.nodeName,
        executionId: log.executionId,
        metadata: log.metadata,
        source: log.metadata?.source,
        duration: log.metadata?.duration,
        stackTrace: log.metadata?.stackTrace
      }));

      if (append) {
        setLogs(prev => [...prev, ...transformedLogs]);
      } else {
        setLogs(transformedLogs);
      }

      setHasMore(response.logs.length === 50);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableNodes = async () => {
    try {
      const workflow = await workflowService.getWorkflow(workflowId);
      const nodes = workflow.nodes.map(node => ({
        id: node.id,
        name: node.label || `Node ${node.id.slice(0, 8)}`
      }));
      setAvailableNodes(nodes);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...logs];

    // Filter by level
    if (filters.level.length > 0) {
      filtered = filtered.filter(log => filters.level.includes(log.level));
    }

    // Filter by node
    if (filters.nodeId.length > 0) {
      filtered = filtered.filter(log => log.nodeId && filters.nodeId.includes(log.nodeId));
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        log.nodeName?.toLowerCase().includes(searchTerm) ||
        log.source?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by date range
    if (filters.dateRange.start) {
      filtered = filtered.filter(log => log.timestamp >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      filtered = filtered.filter(log => log.timestamp <= filters.dateRange.end!);
    }

    // Filter by execution ID
    if (filters.executionId) {
      filtered = filtered.filter(log => log.executionId === filters.executionId);
    }

    setFilteredLogs(filtered);
  }, [logs, filters]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLogs();
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadLogs(page + 1, true);
    }
  };

  const handleExport = async () => {
    try {
      const exportData = filteredLogs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        message: log.message,
        nodeId: log.nodeId,
        nodeName: log.nodeName,
        executionId: log.executionId,
        source: log.source,
        duration: log.duration
      }));

      const csv = [
        'Timestamp,Level,Message,Node ID,Node Name,Execution ID,Source,Duration',
        ...exportData.map(log => 
          `"${log.timestamp}","${log.level}","${log.message}","${log.nodeId || ''}","${log.nodeName || ''}","${log.executionId || ''}","${log.source || ''}","${log.duration || ''}"`
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-logs-${workflowId}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const copyLogToClipboard = (log: LogEntry) => {
    const logText = `[${log.timestamp.toISOString()}] ${log.level}: ${log.message}${
      log.nodeId ? `\nNode: ${log.nodeName || log.nodeId}` : ''
    }${
      log.executionId ? `\nExecution: ${log.executionId}` : ''
    }${
      log.stackTrace ? `\nStack Trace:\n${log.stackTrace}` : ''
    }`;

    navigator.clipboard.writeText(logText);
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'DEBUG': return <Info className="h-4 w-4 text-gray-500" />;
      case 'INFO': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'WARN': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'ERROR': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelBadgeVariant = (level: LogEntry['level']) => {
    switch (level) {
      case 'DEBUG': return 'secondary';
      case 'INFO': return 'default';
      case 'WARN': return 'outline';
      case 'ERROR': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FileText className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Loading logs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Workflow Logs
          </h2>
          <p className="text-muted-foreground">
            Detailed execution logs and debugging information
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <label htmlFor="auto-refresh" className="text-sm font-medium">
              Auto-refresh
            </label>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Level Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Log Level</label>
              <Select
                value={filters.level.join(',')}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  level: value ? value.split(',') : [] 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All levels</SelectItem>
                  <SelectItem value="DEBUG">Debug</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="WARN">Warning</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="DEBUG,INFO">Debug + Info</SelectItem>
                  <SelectItem value="WARN,ERROR">Warnings + Errors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Node Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Node</label>
              <Select
                value={filters.nodeId.join(',')}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  nodeId: value ? value.split(',') : [] 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All nodes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All nodes</SelectItem>
                  {availableNodes.map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Execution Filter */}
            {!executionId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Execution ID</label>
                <Input
                  placeholder="Filter by execution..."
                  value={filters.executionId || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, executionId: e.target.value || undefined }))}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Log Entries ({filteredLogs.length})</span>
            <Badge variant="outline">
              {filteredLogs.filter(log => log.level === 'ERROR').length} errors
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="space-y-1">
              {filteredLogs.map((log, index) => {
                const isExpanded = expandedLogs.has(log.id);
                const hasDetails = log.metadata || log.stackTrace || log.duration;

                return (
                  <div key={log.id} className="border-b last:border-b-0">
                    <div className="flex items-start gap-3 p-4 hover:bg-muted/50">
                      {/* Expand/Collapse Button */}
                      {hasDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleLogExpansion(log.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {/* Level Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getLevelIcon(log.level)}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={getLevelBadgeVariant(log.level)}>
                                {log.level}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {formatTimestamp(log.timestamp)}
                              </span>
                              {log.duration && (
                                <Badge variant="outline" className="text-xs">
                                  {log.duration}ms
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm font-medium mb-1">{log.message}</p>
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {log.nodeName && (
                                <span>Node: {log.nodeName}</span>
                              )}
                              {log.executionId && (
                                <span>Execution: {log.executionId.slice(0, 8)}...</span>
                              )}
                              {log.source && (
                                <span>Source: {log.source}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyLogToClipboard(log)}
                              title="Copy log"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {log.executionId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                title="View execution"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && hasDetails && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
                            {log.metadata && (
                              <div>
                                <h4 className="text-xs font-medium mb-1">Metadata:</h4>
                                <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                            
                            {log.stackTrace && (
                              <div>
                                <h4 className="text-xs font-medium mb-1">Stack Trace:</h4>
                                <pre className="text-xs bg-background p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                                  {log.stackTrace}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredLogs.length === 0 && (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No logs found</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your filters or refresh the logs
                    </p>
                  </div>
                </div>
              )}

              {hasMore && filteredLogs.length > 0 && (
                <div className="p-4 text-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}