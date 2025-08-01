"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Bot, 
  Workflow, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface ActivityItem {
  id: string;
  type: 'agent' | 'workflow' | 'tool';
  name: string;
  action: string;
  timestamp: string;
  status: 'success' | 'error' | 'running';
  user: string;
}

interface SystemHealth {
  overall: number;
  agents: number;
  workflows: number;
  tools: number;
  providers: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon, 
  description 
}) => {
  const changeIcon = changeType === 'positive' ? ArrowUpRight : ArrowDownRight;
  const ChangeIcon = changeIcon;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <div className={cn(
            "flex items-center",
            changeType === 'positive' && "text-green-600",
            changeType === 'negative' && "text-red-600"
          )}>
            <ChangeIcon className="h-3 w-3 mr-1" />
            {change}
          </div>
          {description && <span>from last month</span>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default function DashboardOverview() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 98,
    agents: 95,
    workflows: 100,
    tools: 92,
    providers: 97
  });

  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([
    {
      id: '1',
      type: 'agent',
      name: 'Customer Support Bot',
      action: 'Completed 45 conversations',
      timestamp: '2 minutes ago',
      status: 'success',
      user: 'System'
    },
    {
      id: '2',
      type: 'workflow',
      name: 'Lead Processing Pipeline',
      action: 'Processed 12 new leads',
      timestamp: '5 minutes ago',
      status: 'success',
      user: 'John Doe'
    },
    {
      id: '3',
      type: 'tool',
      name: 'Email Sender',
      action: 'Failed to send notification',
      timestamp: '8 minutes ago',
      status: 'error',
      user: 'System'
    },
    {
      id: '4',
      type: 'agent',
      name: 'Data Analysis Agent',
      action: 'Currently analyzing dataset',
      timestamp: '12 minutes ago',
      status: 'running',
      user: 'Jane Smith'
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'agent':
        return <Bot className="h-4 w-4" />;
      case 'workflow':
        return <Workflow className="h-4 w-4" />;
      case 'tool':
        return <Zap className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemHealth(prev => ({
        ...prev,
        overall: Math.max(90, Math.min(100, prev.overall + (Math.random() - 0.5) * 2))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your AI orchestration platform.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button size="sm">
            <Bot className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Agents"
          value="24"
          change="+12%"
          changeType="positive"
          icon={Bot}
          description="2 new agents this week"
        />
        <MetricCard
          title="Running Workflows"
          value="8"
          change="+4%"
          changeType="positive"
          icon={Workflow}
          description="3 workflows completed today"
        />
        <MetricCard
          title="API Calls"
          value="12,847"
          change="+23%"
          changeType="positive"
          icon={Activity}
          description="Across all providers"
        />
        <MetricCard
          title="Monthly Cost"
          value="$2,847"
          change="-8%"
          changeType="positive"
          icon={DollarSign}
          description="Cost optimization working"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* System Health */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              System Health
            </CardTitle>
            <CardDescription>
              Real-time monitoring of all system components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Health</span>
                <span className="text-sm text-muted-foreground">{systemHealth.overall}%</span>
              </div>
              <Progress value={systemHealth.overall} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Agents</span>
                  <span className="text-sm text-muted-foreground">{systemHealth.agents}%</span>
                </div>
                <Progress value={systemHealth.agents} className="h-1" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Workflows</span>
                  <span className="text-sm text-muted-foreground">{systemHealth.workflows}%</span>
                </div>
                <Progress value={systemHealth.workflows} className="h-1" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tools</span>
                  <span className="text-sm text-muted-foreground">{systemHealth.tools}%</span>
                </div>
                <Progress value={systemHealth.tools} className="h-1" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Providers</span>
                  <span className="text-sm text-muted-foreground">{systemHealth.providers}%</span>
                </div>
                <Progress value={systemHealth.providers} className="h-1" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">All systems operational</span>
              </div>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Bot className="h-4 w-4 mr-2" />
              Create New Agent
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Workflow className="h-4 w-4 mr-2" />
              Build Workflow
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Zap className="h-4 w-4 mr-2" />
              Add Tool
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
            <div className="pt-2 border-t">
              <Button className="w-full" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Invite Team Member
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Activity
              </span>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg border bg-card/50">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(activity.type)}
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.name}</p>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{activity.user}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
              
              <TabsContent value="today" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Response Time</span>
                    <span className="text-sm font-medium">142ms</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Success Rate</span>
                    <span className="text-sm font-medium">99.2%</span>
                  </div>
                  <Progress value={99.2} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Throughput</span>
                    <span className="text-sm font-medium">1,247 req/min</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cost Efficiency</span>
                    <span className="text-sm font-medium">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
              </TabsContent>
              
              <TabsContent value="week" className="space-y-4 mt-4">
                <div className="text-center text-muted-foreground py-8">
                  Weekly metrics visualization would go here
                </div>
              </TabsContent>
              
              <TabsContent value="month" className="space-y-4 mt-4">
                <div className="text-center text-muted-foreground py-8">
                  Monthly metrics visualization would go here
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            System Alerts
          </CardTitle>
          <CardDescription>
            Important notifications and system alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">High API usage detected</p>
                <p className="text-sm text-muted-foreground">OpenAI provider approaching rate limit</p>
              </div>
              <Badge variant="outline">Warning</Badge>
            </div>
            
            <div className="flex items-center space-x-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Backup completed successfully</p>
                <p className="text-sm text-muted-foreground">All data backed up to secure storage</p>
              </div>
              <Badge variant="outline">Success</Badge>
            </div>
            
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Activity className="h-4 w-4 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">System maintenance scheduled</p>
                <p className="text-sm text-muted-foreground">Planned downtime: Tomorrow 2:00 AM - 4:00 AM UTC</p>
              </div>
              <Badge variant="outline">Info</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}