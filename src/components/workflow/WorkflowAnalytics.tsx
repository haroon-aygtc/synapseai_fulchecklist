import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Calendar,
  Zap,
  Target,
  Users
} from 'lucide-react';
import { workflowService } from '@/lib/services/workflow-service';
import { WorkflowStats } from '@/lib/workflows/types';
import { cn } from '@/lib/utils';

interface WorkflowAnalyticsProps {
  workflowId: string;
  className?: string;
}

interface AnalyticsData {
  stats: WorkflowStats;
  executionTrends: {
    date: string;
    executions: number;
    successes: number;
    failures: number;
    avgDuration: number;
    cost: number;
  }[];
  performanceMetrics: {
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    totalCost: number;
    peakExecutionsPerHour: number;
    mostActiveHour: string;
    costPerExecution: number;
    tokenUsage: number;
  };
  nodeAnalytics: {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    executionCount: number;
    avgDuration: number;
    successRate: number;
    errorRate: number;
    cost: number;
    bottleneckScore: number;
  }[];
  errorAnalysis: {
    errorType: string;
    count: number;
    percentage: number;
    nodeId?: string;
    nodeName?: string;
    lastOccurrence: Date;
    trend: 'increasing' | 'decreasing' | 'stable';
  }[];
  costBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    trend: number;
  }[];
}

export default function WorkflowAnalytics({ workflowId, className = '' }: WorkflowAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('executions');

  useEffect(() => {
    loadAnalytics();
  }, [workflowId, timeRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [stats, analytics] = await Promise.all([
        workflowService.getWorkflowStats(workflowId),
        workflowService.getWorkflowAnalytics(workflowId, timeRange)
      ]);

      // Transform and enrich the data
      const enrichedData: AnalyticsData = {
        stats,
        executionTrends: analytics.executionTrends || [],
        performanceMetrics: {
          totalExecutions: stats.totalExecutions,
          successRate: stats.successRate,
          avgExecutionTime: stats.averageDuration,
          totalCost: stats.averageCost ? stats.averageCost * stats.totalExecutions : 0,
          peakExecutionsPerHour: analytics.peakExecutionsPerHour || 0,
          mostActiveHour: analytics.mostActiveHour || '00:00',
          costPerExecution: stats.averageCost || 0,
          tokenUsage: stats.totalTokensUsed || 0
        },
        nodeAnalytics: stats.nodePerformance.map(node => ({
          nodeId: node.nodeId,
          nodeName: analytics.nodeNames?.[node.nodeId] || `Node ${node.nodeId.slice(0, 8)}`,
          nodeType: analytics.nodeTypes?.[node.nodeId] || 'Unknown',
          executionCount: node.executionCount,
          avgDuration: node.averageDuration,
          successRate: ((node.executionCount - (node.errorRate * node.executionCount)) / node.executionCount) * 100,
          errorRate: node.errorRate * 100,
          cost: analytics.nodeCosts?.[node.nodeId] || 0,
          bottleneckScore: calculateBottleneckScore(node)
        })),
        errorAnalysis: stats.mostFrequentErrors.map(error => ({
          errorType: error.message,
          count: error.count,
          percentage: (error.count / stats.totalExecutions) * 100,
          nodeId: error.nodeId,
          nodeName: error.nodeId ? analytics.nodeNames?.[error.nodeId] : undefined,
          lastOccurrence: analytics.errorLastOccurrence?.[error.message] || new Date(),
          trend: analytics.errorTrends?.[error.message] || 'stable'
        })),
        costBreakdown: analytics.costBreakdown || []
      };

      setAnalyticsData(enrichedData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateBottleneckScore = (node: any): number => {
    // Calculate bottleneck score based on duration and error rate
    const durationScore = Math.min(node.averageDuration / 1000, 10) * 10;
    const errorScore = node.errorRate * 100;
    return Math.round((durationScore + errorScore) / 2);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAnalytics();
    setIsRefreshing(false);
  };

  const handleExport = async () => {
    try {
      const blob = await workflowService.exportAnalytics(workflowId, timeRange);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-analytics-${workflowId}-${timeRange}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: string | number) => {
    if (typeof trend === 'number') {
      return trend > 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : 
             trend < 0 ? <TrendingDown className="h-4 w-4 text-red-500" /> : 
             <Activity className="h-4 w-4 text-gray-500" />;
    }
    
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p>Failed to load analytics data</p>
            <Button onClick={loadAnalytics} className="mt-2">
              Try Again
            </Button>
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
          <h2 className="text-2xl font-bold">Workflow Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights and metrics for your workflow
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Executions</p>
                <p className="text-2xl font-bold">{analyticsData.performanceMetrics.totalExecutions.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className={cn('text-2xl font-bold', getSuccessRateColor(analyticsData.performanceMetrics.successRate))}>
                  {analyticsData.performanceMetrics.successRate.toFixed(1)}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {formatDuration(analyticsData.performanceMetrics.avgExecutionTime)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(analyticsData.performanceMetrics.totalCost)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs value={selectedMetric} onValueChange={setSelectedMetric} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="nodes">Nodes</TabsTrigger>
        </TabsList>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Execution Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.executionTrends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{new Date(trend.date).toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {trend.executions} executions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge variant={trend.successes > trend.failures ? 'default' : 'destructive'}>
                          {((trend.successes / trend.executions) * 100).toFixed(1)}% success
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Avg: {formatDuration(trend.avgDuration)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Peak Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Peak Executions/Hour</span>
                  <span className="font-bold">{analyticsData.performanceMetrics.peakExecutionsPerHour}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Most Active Hour</span>
                  <span className="font-bold">{analyticsData.performanceMetrics.mostActiveHour}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Token Usage</span>
                  <span className="font-bold">{analyticsData.performanceMetrics.tokenUsage.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Efficiency Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className={cn('font-bold', getSuccessRateColor(analyticsData.performanceMetrics.successRate))}>
                      {analyticsData.performanceMetrics.successRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={analyticsData.performanceMetrics.successRate} className="h-2" />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cost per Execution</span>
                  <span className="font-bold">{formatCurrency(analyticsData.performanceMetrics.costPerExecution)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.costBreakdown.map((cost, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <div>
                        <p className="font-medium">{cost.category}</p>
                        <p className="text-sm text-muted-foreground">
                          {cost.percentage.toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(cost.amount)}</p>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(cost.trend)}
                        <span className="text-sm text-muted-foreground">
                          {cost.trend > 0 ? '+' : ''}{cost.trend.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Error Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.errorAnalysis.map((error, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="font-medium">{error.errorType}</p>
                        <p className="text-sm text-muted-foreground">
                          {error.nodeName ? `Node: ${error.nodeName}` : 'System error'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">
                          {error.count} ({error.percentage.toFixed(1)}%)
                        </Badge>
                        {getTrendIcon(error.trend)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Last: {new Date(error.lastOccurrence).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nodes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Node Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.nodeAnalytics
                  .sort((a, b) => b.bottleneckScore - a.bottleneckScore)
                  .map((node, index) => (
                  <div key={node.nodeId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-3 h-3 rounded-full',
                        node.bottleneckScore > 70 ? 'bg-red-500' :
                        node.bottleneckScore > 40 ? 'bg-yellow-500' : 'bg-green-500'
                      )} />
                      <div>
                        <p className="font-medium">{node.nodeName}</p>
                        <p className="text-sm text-muted-foreground">
                          {node.nodeType} • {node.executionCount} executions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={node.successRate > 95 ? 'default' : 'destructive'}>
                          {node.successRate.toFixed(1)}% success
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Avg: {formatDuration(node.avgDuration)} • {formatCurrency(node.cost)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">Bottleneck Score:</span>
                        <span className={cn(
                          'text-xs font-medium',
                          node.bottleneckScore > 70 ? 'text-red-600' :
                          node.bottleneckScore > 40 ? 'text-yellow-600' : 'text-green-600'
                        )}>
                          {node.bottleneckScore}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}