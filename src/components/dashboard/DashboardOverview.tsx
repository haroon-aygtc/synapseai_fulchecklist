"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart2,
  Box,
  CpuIcon,
  Database,
  LineChart,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
}

const MetricCard = (
  { title, value, description, trend, icon }: MetricCardProps = {
    title: "Metric",
    value: "0",
    icon: <Activity className="h-4 w-4" />,
  },
) => {
  return (
    <Card className="bg-background">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <span
              className={`text-xs ${trend.isPositive ? "text-green-500" : "text-red-500"}`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ActivityLogProps {
  logs?: Array<{
    id: string;
    message: string;
    timestamp: string;
    type: "info" | "warning" | "error" | "success";
  }>;
}

const ActivityLog = ({
  logs = [
    {
      id: "1",
      message: 'Agent "Customer Support" deployed successfully',
      timestamp: "2023-06-15T10:30:00Z",
      type: "success",
    },
    {
      id: "2",
      message: 'Workflow "Order Processing" execution completed',
      timestamp: "2023-06-15T09:45:00Z",
      type: "info",
    },
    {
      id: "3",
      message:
        "OpenAI provider rate limit reached, fallback to Claude activated",
      timestamp: "2023-06-15T09:30:00Z",
      type: "warning",
    },
    {
      id: "4",
      message: 'Tool "Database Query" failed to execute',
      timestamp: "2023-06-15T08:15:00Z",
      type: "error",
    },
    {
      id: "5",
      message: 'New agent "Product Recommendation" created',
      timestamp: "2023-06-14T16:20:00Z",
      type: "info",
    },
  ],
}: ActivityLogProps) => {
  const getLogIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "success":
        return <Activity className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card className="bg-background">
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <CardDescription>System events and notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-3">
            <div className="mt-0.5">{getLogIcon(log.type)}</div>
            <div className="space-y-1">
              <p className="text-sm">{log.message}</p>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(log.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" className="w-full">
          View all activity
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

interface ResourceUsageProps {
  resources?: Array<{
    name: string;
    used: number;
    total: number;
    unit: string;
  }>;
}

const ResourceUsage = ({
  resources = [
    { name: "API Calls", used: 8750, total: 10000, unit: "calls" },
    { name: "Storage", used: 4.2, total: 10, unit: "GB" },
    { name: "Compute", used: 65, total: 100, unit: "hours" },
  ],
}: ResourceUsageProps) => {
  return (
    <Card className="bg-background">
      <CardHeader>
        <CardTitle className="text-lg">Resource Usage</CardTitle>
        <CardDescription>Current billing period</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {resources.map((resource) => {
          const percentage = Math.round((resource.used / resource.total) * 100);
          return (
            <div key={resource.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{resource.name}</span>
                <span className="text-sm text-muted-foreground">
                  {resource.used} / {resource.total} {resource.unit}
                </span>
              </div>
              <Progress value={percentage} />
            </div>
          );
        })}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" className="w-full">
          View usage details
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

interface QuickAccessCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}

const QuickAccessCard = ({
  title,
  description,
  icon,
  href = "#",
}: QuickAccessCardProps) => {
  return (
    <Card className="bg-background hover:bg-accent/50 transition-colors cursor-pointer">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-md">{icon}</div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardFooter>
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <a href={href}>
            Access
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function DashboardOverview() {
  return (
    <div className="p-6 space-y-6 bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to SynapseAI platform overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Enterprise Plan
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Agents"
              value="24"
              trend={{ value: 12, isPositive: true }}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              title="Active Workflows"
              value="18"
              trend={{ value: 5, isPositive: true }}
              icon={<LineChart className="h-4 w-4" />}
            />
            <MetricCard
              title="API Calls Today"
              value="1,284"
              trend={{ value: 8, isPositive: true }}
              icon={<BarChart2 className="h-4 w-4" />}
            />
            <MetricCard
              title="Avg. Response Time"
              value="1.2s"
              trend={{ value: 3, isPositive: false }}
              icon={<Activity className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 bg-background">
              <CardHeader>
                <CardTitle className="text-lg">Performance Metrics</CardTitle>
                <CardDescription>System performance over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <div className="text-muted-foreground text-sm flex flex-col items-center">
                  <BarChart2 className="h-16 w-16 mb-2 text-muted-foreground/50" />
                  <p>Performance chart visualization</p>
                  <p className="text-xs">Showing data for the last 30 days</p>
                </div>
              </CardContent>
            </Card>

            <div className="col-span-3 grid gap-4 lg:grid-rows-2">
              <ActivityLog />
              <ResourceUsage />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Quick Access</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <QuickAccessCard
                title="Agent Management"
                description="Create and manage AI agents"
                icon={<MessageSquare className="h-5 w-5 text-primary" />}
                href="/agents"
              />
              <QuickAccessCard
                title="Tool Management"
                description="Configure and test tools"
                icon={<Box className="h-5 w-5 text-primary" />}
                href="/tools"
              />
              <QuickAccessCard
                title="Workflow Builder"
                description="Design AI orchestration workflows"
                icon={<LineChart className="h-5 w-5 text-primary" />}
                href="/workflows"
              />
              <QuickAccessCard
                title="Provider Settings"
                description="Configure AI providers and routing"
                icon={<CpuIcon className="h-5 w-5 text-primary" />}
                href="/providers"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="bg-background">
            <CardHeader>
              <CardTitle className="text-lg">Analytics Dashboard</CardTitle>
              <CardDescription>
                Detailed performance analytics and insights
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center">
              <div className="text-muted-foreground text-sm flex flex-col items-center">
                <BarChart2 className="h-16 w-16 mb-2 text-muted-foreground/50" />
                <p>Analytics visualization</p>
                <p className="text-xs">
                  Select metrics and timeframes to analyze
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card className="bg-background">
            <CardHeader>
              <CardTitle className="text-lg">Generated Reports</CardTitle>
              <CardDescription>System and usage reports</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center">
              <div className="text-muted-foreground text-sm flex flex-col items-center">
                <Database className="h-16 w-16 mb-2 text-muted-foreground/50" />
                <p>Reports will be displayed here</p>
                <p className="text-xs">
                  Generate custom reports from the control panel
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="bg-background">
            <CardHeader>
              <CardTitle className="text-lg">System Notifications</CardTitle>
              <CardDescription>Alerts and important messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start space-x-3 pb-4">
                    <div className="mt-0.5">
                      <AlertCircle className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm">System notification example {i}</p>
                      <p className="text-xs text-muted-foreground">
                        Today at 10:30 AM
                      </p>
                    </div>
                    <Separator />
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
