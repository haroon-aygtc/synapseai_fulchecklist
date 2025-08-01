"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Bot,
  Wrench,
  Workflow,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
  Users,
  DollarSign,
  BarChart3,
  Plus,
  ArrowUpRight,
  Calendar,
  Filter
} from 'lucide-react';

interface DashboardOverviewProps {
  className?: string;
}

const metrics = [
  {
    title: 'Active Agents',
    value: '12',
    change: '+2',
    changeType: 'positive' as const,
    icon: Bot,
    description: 'from last week'
  },
  {
    title: 'Active Tools',
    value: '24',
    change: '+4',
    changeType: 'positive' as const,
    icon: Wrench,
    description: 'from last week'
  },
  {
    title: 'Running Workflows',
    value: '7',
    change: '+1',
    changeType: 'positive' as const,
    icon: Workflow,
    description: 'from last week'
  },
  {
    title: 'API Calls Today',
    value: '1,324',
    change: '+12%',
    changeType: 'positive' as const,
    icon: Activity,
    description: 'from yesterday'
  },
  {
    title: 'Response Time',
    value: '142ms',
    change: '-8ms',
    changeType: 'positive' as const,
    icon: Zap,
    description: 'avg response'
  },
  {
    title: 'Success Rate',
    value: '99.2%',
    change: '+0.3%',
    changeType: 'positive' as const,
    icon: CheckCircle,
    description: 'last 24h'
  },
  {
    title: 'Active Users',
    value: '48',
    change: '+6',
    changeType: 'positive' as const,
    icon: Users,
    description: 'this month'
  },
  {
    title: 'Cost Today',
    value: '$23.45',
    change: '-$2.10',
    changeType: 'positive' as const,
    icon: DollarSign,
    description: 'vs yesterday'
  }
];

const recentActivity = [
  {
    id: 1,
    type: 'agent',
    title: 'Customer Support Agent deployed',
    description: 'Successfully deployed to production',
    time: '2 minutes ago',
    status: 'success',
    icon: Bot
  },
  {
    id: 2,
    type: 'workflow',
    title: 'Data Processing Workflow completed',
    description: 'Processed 1,247 records in 3.2 seconds',
    time: '5 minutes ago',
    status: 'success',
    icon: Workflow
  },
  {
    id: 3,
    type: 'tool',
    title: 'Email Tool configuration updated',
    description: 'SMTP settings modified',
    time: '12 minutes ago',
    status: 'info',
    icon: Wrench
  },
  {
    id: 4,
    type: 'alert',
    title: 'High API usage detected',
    description: 'Approaching daily limit (85% used)',
    time: '18 minutes ago',
    status: 'warning',
    icon: AlertCircle
  },
  {
    id: 5,
    type: 'agent',
    title: 'Sales Assistant Agent created',
    description: 'Ready for testing and deployment',
    time: '25 minutes ago',
    status: 'info',
    icon: Bot
  }
];

const quickActions = [
  {
    title: 'Create Agent',
    description: 'Build a new AI agent from scratch or template',
    icon: Bot,
    href: '/agents/create',
    color: 'bg-blue-500'
  },
  {
    title: 'Add Tool',
    description: 'Configure a new tool for your agents',
    icon: Wrench,
    href: '/tools/create',
    color: 'bg-green-500'
  },
  {
    title: 'Design Workflow',
    description: 'Create a new orchestration workflow',
    icon: Workflow,
    href: '/workflows/create',
    color: 'bg-purple-500'
  },
  {
    title: 'View Analytics',
    description: 'Analyze performance and usage metrics',
    icon: BarChart3,
    href: '/analytics',
    color: 'bg-orange-500'
  }
];

export default function DashboardOverview({ className }: DashboardOverviewProps) {
  return (
    <div className={`space-y-6 p-6 bg-background ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your AI platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Last 7 days
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className={`flex items-center ${
                    metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.changeType === 'positive' ? (
                      <TrendingUp className="mr-1 h-3 w-3" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3" />
                    )}
                    {metric.change}
                  </span>
                  <span className="ml-1">{metric.description}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="resources">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* System Health */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Overall platform performance status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>API Response Time</span>
                    <span className="text-green-600">Excellent</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>System Uptime</span>
                    <span className="text-green-600">99.9%</span>
                  </div>
                  <Progress value={99.9} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Error Rate</span>
                    <span className="text-green-600">0.1%</span>
                  </div>
                  <Progress value={0.1} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Resource Usage */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Resource Usage
                </CardTitle>
                <CardDescription>
                  Current resource allocation and consumption
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>CPU Usage</span>
                    <span>34%</span>
                  </div>
                  <Progress value={34} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span>67%</span>
                  </div>
                  <Progress value={67} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Storage Used</span>
                    <span>23%</span>
                  </div>
                  <Progress value={23} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Agents */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Top Agents
                </CardTitle>
                <CardDescription>
                  Best performing agents this week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Customer Support', calls: 1247, success: 98.5 },
                    { name: 'Sales Assistant', calls: 892, success: 96.2 },
                    { name: 'Data Processor', calls: 634, success: 99.1 },
                    { name: 'Content Writer', calls: 423, success: 94.8 }
                  ].map((agent, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.calls} calls
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {agent.success}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest events and updates across your platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg border">
                      <div className={`p-2 rounded-full ${
                        activity.status === 'success' ? 'bg-green-100 text-green-600' :
                        activity.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>
                  System performance over the last 7 days
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <div className="h-full w-full rounded-md border border-dashed flex items-center justify-center">
                  <p className="text-muted-foreground">Performance Chart Placeholder</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Usage Analytics</CardTitle>
                <CardDescription>
                  API calls and resource usage patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <div className="h-full w-full rounded-md border border-dashed flex items-center justify-center">
                  <p className="text-muted-foreground">Usage Chart Placeholder</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Card key={index} className="bg-card hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-2`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">
                      Get Started
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}