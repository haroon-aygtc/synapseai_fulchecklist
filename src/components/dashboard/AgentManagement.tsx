"use client";

import React, { useState } from "react";
import {
  PlusCircle,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Agent {
  id: string;
  name: string;
  description: string;
  provider: string;
  status: "active" | "inactive" | "error";
  type: "standalone" | "tool-driven" | "hybrid" | "multi-task";
  createdAt: string;
  lastUsed: string;
}

const AgentManagement = () => {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: "1",
      name: "Customer Support Agent",
      description: "Handles customer inquiries and support tickets",
      provider: "OpenAI",
      status: "active",
      type: "hybrid",
      createdAt: "2023-10-15T10:30:00Z",
      lastUsed: "2023-11-01T14:22:00Z",
    },
    {
      id: "2",
      name: "Data Analysis Agent",
      description: "Analyzes data and generates reports",
      provider: "Claude",
      status: "inactive",
      type: "tool-driven",
      createdAt: "2023-09-20T08:15:00Z",
      lastUsed: "2023-10-28T11:45:00Z",
    },
    {
      id: "3",
      name: "Content Generator",
      description: "Creates marketing content and blog posts",
      provider: "Gemini",
      status: "active",
      type: "standalone",
      createdAt: "2023-10-05T16:20:00Z",
      lastUsed: "2023-10-31T09:10:00Z",
    },
    {
      id: "4",
      name: "Research Assistant",
      description: "Conducts research and summarizes findings",
      provider: "OpenAI",
      status: "error",
      type: "multi-task",
      createdAt: "2023-08-12T13:45:00Z",
      lastUsed: "2023-10-25T15:30:00Z",
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    provider: "OpenAI",
    type: "standalone",
  });
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [isTestingAgent, setIsTestingAgent] = useState(false);

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateAgent = () => {
    const newAgentData: Agent = {
      id: `${agents.length + 1}`,
      name: newAgent.name,
      description: newAgent.description,
      provider: newAgent.provider,
      type: newAgent.type as
        | "standalone"
        | "tool-driven"
        | "hybrid"
        | "multi-task",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    setAgents([...agents, newAgentData]);
    setNewAgent({
      name: "",
      description: "",
      provider: "OpenAI",
      type: "standalone",
    });
    setIsCreateDialogOpen(false);
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(agents.filter((agent) => agent.id !== id));
  };

  const handleToggleAgentStatus = (id: string) => {
    setAgents(
      agents.map((agent) => {
        if (agent.id === id) {
          return {
            ...agent,
            status: agent.status === "active" ? "inactive" : "active",
            lastUsed: new Date().toISOString(),
          };
        }
        return agent;
      }),
    );
  };

  const handleTestAgent = () => {
    if (!selectedAgent || !testPrompt) return;

    setIsTestingAgent(true);
    setTestResponse("");

    // Simulate API call with a timeout
    setTimeout(() => {
      setTestResponse(
        `Response from ${selectedAgent.name} (${selectedAgent.provider}):\n\nThis is a simulated response to your prompt: "${testPrompt}".\n\nIn a real implementation, this would connect to the actual AI provider and return a genuine response based on the agent's configuration and capabilities.`,
      );
      setIsTestingAgent(false);
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "inactive":
        return "bg-gray-400";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-background p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Agent Management</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Agent
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>
            Manage your AI agents for different tasks and workflows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-4 text-muted-foreground"
                  >
                    No agents found. Create your first agent to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{agent.type}</Badge>
                    </TableCell>
                    <TableCell>{agent.provider}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className={`h-2 w-2 rounded-full mr-2 ${getStatusColor(agent.status)}`}
                        />
                        <span className="capitalize">{agent.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(agent.createdAt)}</TableCell>
                    <TableCell>{formatDate(agent.lastUsed)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedAgent(agent);
                              setIsTestDialogOpen(true);
                            }}
                          >
                            Test Agent
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleAgentStatus(agent.id)}
                          >
                            {agent.status === "active" ? (
                              <>
                                <Pause className="mr-2 h-4 w-4" /> Deactivate
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteAgent(agent.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredAgents.length} of {agents.length} agents
          </div>
        </CardFooter>
      </Card>

      {/* Create Agent Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure your new AI agent. You can customize its capabilities
              and behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newAgent.name}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, name: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={newAgent.description}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, description: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="provider" className="text-right">
                Provider
              </Label>
              <Select
                value={newAgent.provider}
                onValueChange={(value) =>
                  setNewAgent({ ...newAgent, provider: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OpenAI">OpenAI</SelectItem>
                  <SelectItem value="Claude">Claude</SelectItem>
                  <SelectItem value="Gemini">Gemini</SelectItem>
                  <SelectItem value="Mistral">Mistral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Select
                value={newAgent.type}
                onValueChange={(value) =>
                  setNewAgent({ ...newAgent, type: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone</SelectItem>
                  <SelectItem value="tool-driven">Tool-driven</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="multi-task">Multi-task</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateAgent} disabled={!newAgent.name}>
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Agent Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Test Agent: {selectedAgent?.name}</DialogTitle>
            <DialogDescription>
              Send a test prompt to the agent and see how it responds.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>
            <TabsContent value="prompt" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-prompt">Test Prompt</Label>
                <Textarea
                  id="test-prompt"
                  placeholder="Enter your test prompt here..."
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="response">Response</Label>
                <div className="border rounded-md p-4 min-h-[150px] bg-muted/30 whitespace-pre-wrap">
                  {isTestingAgent ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-pulse">Processing request...</div>
                    </div>
                  ) : testResponse ? (
                    testResponse
                  ) : (
                    <div className="text-muted-foreground text-center">
                      Response will appear here after testing
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="config" className="py-4">
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="font-medium text-right">Provider:</div>
                  <div className="col-span-3">{selectedAgent?.provider}</div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="font-medium text-right">Type:</div>
                  <div className="col-span-3">{selectedAgent?.type}</div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="font-medium text-right">Status:</div>
                  <div className="col-span-3 flex items-center">
                    <div
                      className={`h-2 w-2 rounded-full mr-2 ${selectedAgent ? getStatusColor(selectedAgent.status) : ""}`}
                    />
                    <span className="capitalize">{selectedAgent?.status}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="font-medium text-right">Created:</div>
                  <div className="col-span-3">
                    {selectedAgent ? formatDate(selectedAgent.createdAt) : ""}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTestDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleTestAgent}
              disabled={!testPrompt || isTestingAgent}
            >
              {isTestingAgent ? "Testing..." : "Test Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentManagement;
