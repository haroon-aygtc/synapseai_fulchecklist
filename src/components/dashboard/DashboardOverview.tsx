'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bot, 
  Wrench, 
  Workflow, 
  TrendingUp, 
  Users, 
  Activity,
  Plus,
  ArrowRight,
  Zap,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { toast } from '@/components/ui/use-toast';
import { agentService } from '@/lib/services/agent-service';
import { toolService } from '@/lib/services/tool-service';
import { workflowService } from '@/lib/services/workflow-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface DashboardStats {
  agents: {
    total: number;
    active: number;
    draft: number;
    totalSessions: number;
    avgResponseTime: number;
  };
  tools: {
    total: number;
    active: number;
    totalExecutions: number;
    successRate: number;
  };
  workflows: {
    total: number;
    active: number;
    running: number;
    totalExecutions: number;
    successRate: number;
  };
  costs: {
    thisMonth: number;
    lastMonth: number;
    trend: number;
    breakdown: Array<{
      provider: string;
      amount: number;
      percentage: number;
    }>;
  };
}

interface RecentActivity {
  id: string;
  type: 'agent' | 'tool' | 'workflow';
  action: string;
  name: string;
  timestamp: Date;
  status: 'success' | 'error' | 'running';
}

// Production API service integration
import dashboardApiService, { 
  DashboardStats as ApiDashboardStats,
  RecentActivity as ApiRecentActivity 
} from '@/lib/services/dashboard-api-service';

export default function DashboardOverview() {
  const { user, organization, hasPermission } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<ApiDashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ApiRecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization?.id) {
      loadDashboardData();
      
      // Set up real-time updates
      const unsubscribe = dashboardApiService.subscribeToRealTimeUpdates((updates) => {
        setStats(prev => prev ? { ...prev, ...updates } : null);
      });

      return unsubscribe;
    }
  }, [organization?.id]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load real dashboard data from API
      const [statsData, activityData] = await Promise.all([
        dashboardApiService.getStats(),
        dashboardApiService.getRecentActivity(20)
      ]);

      setStats(statsData);
      setRecentActivity(activityData.activities);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      toast({
        title: 'Loading Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshData = async () => {
    try {
      await dashboardApiService.refreshCache();
      await loadDashboardData();
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const handleExportData = async (type: 'stats' | 'activity' | 'usage') => {
    try {
      const blob = await dashboardApiService.exportData(type, 'csv');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Error handling is done in the service
    }
  };

  const quickActions = [
    {
      title: 'Create Agent',
      description: 'Build a new AI agent',
      icon: Bot,
      href: '/agents/new',
      gradient: 'from-blue-500 to-cyan-500',
      permission: 'AGENTS_CREATE'
    },
    {
      title: 'Add Tool',
      description: 'Integrate a new tool',
      icon: Wrench,
      href: '/tools/new',
      gradient: 'from-green-500 to-emerald-500',
      permission: 'TOOLS_CREATE'
    },
    {
      title: 'Build Workflow',
      description: 'Design automation',
      icon: Workflow,
      href: '/workflows/new',
      gradient: 'from-purple-500 to-pink-500',
      permission: 'WORKFLOWS_CREATE'
    },
    {
      title: 'View Analytics',
      description: 'Monitor performance',
      icon: BarChart3,
      href: '/analytics',
      gradient: 'from-orange-500 to-red-500',
      permission: 'ANALYTICS_VIEW'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Here's what's happening with your AI orchestration platform
          </p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
            <Activity className="w-3 h-3 mr-1" />
            All Systems Operational
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Card 
            key={action.title}
            className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-800/50 hover:-translate-y-1 border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
            onClick={() => router.push(action.href)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn(
                  "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300",
                  action.gradient
                )}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                  {action.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {action.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Active Agents
              </CardTitle>
              <Bot className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.agents.active}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.agents.total} total agents
              </p>
              <div className="mt-2">
                <Progress 
                  value={(stats.agents.active / stats.agents.total) * 100} 
                  className="h-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Tool Success Rate
              </CardTitle>
              <Wrench className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.tools.successRate}%
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.tools.totalExecutions} executions
              </p>
              <div className="mt-2">
                <Progress 
                  value={stats.tools.successRate} 
                  className="h-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Running Workflows
              </CardTitle>
              <Workflow className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.workflows.running}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.workflows.active} active workflows
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <Activity className="w-3 h-3 text-purple-500 animate-pulse" />
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  Live execution
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Monthly Cost
              </CardTitle>
              <DollarSign className="w-4 h-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ${stats.costs.thisMonth.toFixed(2)}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                +{stats.costs.trend}% from last month
              </p>
              <div className="mt-2">
                <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>Trending up</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>
              Latest actions across your platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex-shrink-0">
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {activity.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activity.action} • {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      activity.type === 'agent' && "border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
                      activity.type === 'tool' && "border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
                      activity.type === 'workflow' && "border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                    )}
                  >
                    {activity.type}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
              <Button 
                variant="ghost" 
                className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                onClick={() => router.push('/analytics')}
              >
                View all activity
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card className="border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-orange-600" />
              <span>Cost Breakdown</span>
            </CardTitle>
            <CardDescription>
              Provider spending this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats && (
              <div className="space-y-4">
                {stats.costs.breakdown.map((item, index) => (
                  <div key={item.provider} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        index === 0 && "bg-blue-500",
                        index === 1 && "bg-green-500",
                        index === 2 && "bg-purple-500"
                      )} />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.provider}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        ${item.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.percentage}%
                      </p>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/analytics/costs')}
                  >
                    View detailed costs
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}