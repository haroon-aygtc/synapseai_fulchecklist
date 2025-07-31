import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Activity,
  Users,
  Settings,
  Layers,
  Code,
  Workflow,
} from "lucide-react";

export default function Home() {
  // In a real implementation, this would check authentication state
  // For now, we'll assume the user is authenticated
  const isAuthenticated = true;

  if (!isAuthenticated) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6" />
            <h1 className="text-xl font-bold">SynapseAI</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Users className="h-5 w-5" />
            </Button>
            <div className="relative h-8 w-8 overflow-hidden rounded-full bg-primary">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
                alt="User Avatar"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar Navigation */}
        <aside className="hidden w-64 flex-col border-r bg-background md:flex">
          <nav className="grid items-start px-4 py-4 text-sm font-medium">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-accent-foreground"
            >
              <Activity className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/agents"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Code className="h-4 w-4" />
              Agents
            </Link>
            <Link
              href="/tools"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-4 w-4" />
              Tools
            </Link>
            <Link
              href="/workflows"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Workflow className="h-4 w-4" />
              Workflows
            </Link>
            <Link
              href="/providers"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Layers className="h-4 w-4" />
              Providers
            </Link>
            <Link
              href="/analytics"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <BarChart className="h-4 w-4" />
              Analytics
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Agents
                  </CardTitle>
                  <Code className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    +2 from last week
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Tools
                  </CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">
                    +4 from last week
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Workflows
                  </CardTitle>
                  <Workflow className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">7</div>
                  <p className="text-xs text-muted-foreground">
                    +1 from last week
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    API Calls
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,324</div>
                  <p className="text-xs text-muted-foreground">
                    +12% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for different sections */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="recent">Recent Activity</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle>Performance</CardTitle>
                      <CardDescription>
                        System performance metrics over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <div className="h-full w-full rounded-md border border-dashed flex items-center justify-center">
                        <p className="text-muted-foreground">
                          Performance Chart
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle>Resource Usage</CardTitle>
                      <CardDescription>
                        Current resource allocation and usage
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <div className="h-full w-full rounded-md border border-dashed flex items-center justify-center">
                        <p className="text-muted-foreground">
                          Resource Usage Chart
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle>Recent Logs</CardTitle>
                      <CardDescription>
                        Latest system activity logs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-4 rounded-md border p-3"
                          >
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <div>
                              <p className="text-sm font-medium">
                                Workflow execution completed
                              </p>
                              <p className="text-xs text-muted-foreground">
                                2 minutes ago
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full">
                        View All Logs
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="recent" className="space-y-4">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                      Your recent platform activity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 rounded-md border p-3"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                            {i % 3 === 0 ? (
                              <Code className="h-4 w-4" />
                            ) : i % 3 === 1 ? (
                              <Settings className="h-4 w-4" />
                            ) : (
                              <Workflow className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {i % 3 === 0
                                ? "Agent created"
                                : i % 3 === 1
                                  ? "Tool configured"
                                  : "Workflow deployed"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {30 - i * 3} minutes ago
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      Load More
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              <TabsContent value="resources" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle>Create Agent</CardTitle>
                      <CardDescription>
                        Build and deploy a new AI agent
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Create intelligent agents that can interact with users
                        and tools.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full">Create Agent</Button>
                    </CardFooter>
                  </Card>
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle>Configure Tool</CardTitle>
                      <CardDescription>
                        Set up a new tool for your agents
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Create tools that agents can use to perform specific
                        tasks.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full">Configure Tool</Button>
                    </CardFooter>
                  </Card>
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle>Design Workflow</CardTitle>
                      <CardDescription>
                        Create a new orchestration workflow
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Build workflows that combine agents and tools for
                        complex tasks.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full">Design Workflow</Button>
                    </CardFooter>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
