"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Save,
  Play,
  Settings,
  X,
  ArrowRight,
  ChevronRight,
  Search,
  Trash2,
  Edit,
  Copy,
  Eye,
  PlusCircle,
  Workflow,
  Bot,
  Code,
  Database,
  FileText,
  Zap,
  Wrench,
} from "lucide-react";

interface WorkflowNode {
  id: string;
  type: "agent" | "tool" | "condition" | "trigger";
  name: string;
  description?: string;
  position: { x: number; y: number };
  connections: string[];
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "inactive";
}

const WorkflowBuilder = () => {
  const [activeTab, setActiveTab] = useState("canvas");
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [isAddNodeDialogOpen, setIsAddNodeDialogOpen] = useState(false);

  // Sample workflow data
  const [workflow, setWorkflow] = useState<WorkflowData>({
    id: "wf-1",
    name: "Customer Support Workflow",
    description: "Handles customer inquiries and routes to appropriate agents",
    nodes: [
      {
        id: "node-1",
        type: "trigger",
        name: "New Support Request",
        description: "Triggered when a new support request is received",
        position: { x: 100, y: 100 },
        connections: ["node-2"],
      },
      {
        id: "node-2",
        type: "agent",
        name: "Triage Agent",
        description: "Analyzes the request and determines the category",
        position: { x: 300, y: 100 },
        connections: ["node-3", "node-4"],
      },
      {
        id: "node-3",
        type: "condition",
        name: "Is Technical Issue?",
        description: "Checks if the request is a technical issue",
        position: { x: 500, y: 50 },
        connections: ["node-5"],
      },
      {
        id: "node-4",
        type: "condition",
        name: "Is Billing Issue?",
        description: "Checks if the request is a billing issue",
        position: { x: 500, y: 150 },
        connections: ["node-6"],
      },
      {
        id: "node-5",
        type: "agent",
        name: "Technical Support Agent",
        description: "Handles technical support requests",
        position: { x: 700, y: 50 },
        connections: [],
      },
      {
        id: "node-6",
        type: "agent",
        name: "Billing Support Agent",
        description: "Handles billing inquiries",
        position: { x: 700, y: 150 },
        connections: [],
      },
    ],
    createdAt: "2023-06-15T10:30:00Z",
    updatedAt: "2023-06-16T14:45:00Z",
    status: "draft",
  });

  // Sample available components for the toolbox
  const availableComponents = {
    agents: [
      {
        id: "agent-1",
        name: "Customer Service Agent",
        description: "Handles general customer inquiries",
      },
      {
        id: "agent-2",
        name: "Technical Support Agent",
        description: "Resolves technical issues",
      },
      {
        id: "agent-3",
        name: "Sales Agent",
        description: "Handles sales inquiries and processes",
      },
    ],
    tools: [
      {
        id: "tool-1",
        name: "Database Lookup",
        description: "Retrieves customer information from database",
      },
      {
        id: "tool-2",
        name: "Email Sender",
        description: "Sends automated emails to customers",
      },
      {
        id: "tool-3",
        name: "Ticket Creator",
        description: "Creates support tickets in the system",
      },
    ],
    conditions: [
      {
        id: "condition-1",
        name: "Customer Type Check",
        description: "Routes based on customer type",
      },
      {
        id: "condition-2",
        name: "Sentiment Analysis",
        description: "Routes based on message sentiment",
      },
      {
        id: "condition-3",
        name: "Time-based Routing",
        description: "Routes based on time of day",
      },
    ],
    triggers: [
      {
        id: "trigger-1",
        name: "New Message",
        description: "Triggered when a new message is received",
      },
      {
        id: "trigger-2",
        name: "Scheduled",
        description: "Triggered on a schedule",
      },
      {
        id: "trigger-3",
        name: "API Webhook",
        description: "Triggered by an external API call",
      },
    ],
  };

  const handleNodeSelect = (node: WorkflowNode) => {
    setSelectedNode(node);
    setIsPropertiesOpen(true);
  };

  const handleAddNode = (type: string, componentId: string) => {
    // Implementation would add a new node to the workflow
    setIsAddNodeDialogOpen(false);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "agent":
        return <Bot className="h-4 w-4" />;
      case "tool":
        return <Wrench className="h-4 w-4" />;
      case "condition":
        return <Code className="h-4 w-4" />;
      case "trigger":
        return <Zap className="h-4 w-4" />;
      default:
        return <Workflow className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <Workflow className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-semibold">{workflow.name}</h1>
            <p className="text-sm text-muted-foreground">
              {workflow.description}
            </p>
          </div>
          <Badge variant={workflow.status === "active" ? "default" : "outline"}>
            {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-2" /> Test
          </Button>
          <Button size="sm">
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbox Panel */}
        <div className="w-64 border-r bg-background p-4 flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-semibold mb-2">Components</h2>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search components..." className="pl-8" />
            </div>
          </div>

          <Tabs defaultValue="agents" className="flex-1">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="agents">
                <Bot className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="tools">
                <Wrench className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="conditions">
                <Code className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="triggers">
                <Zap className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-2">
              <TabsContent value="agents" className="space-y-2 mt-2">
                {availableComponents.agents.map((agent) => (
                  <Card key={agent.id} className="cursor-grab">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{agent.name}</CardTitle>
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardDescription className="text-xs">
                        {agent.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="tools" className="space-y-2 mt-2">
                {availableComponents.tools.map((tool) => (
                  <Card key={tool.id} className="cursor-grab">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{tool.name}</CardTitle>
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardDescription className="text-xs">
                        {tool.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="conditions" className="space-y-2 mt-2">
                {availableComponents.conditions.map((condition) => (
                  <Card key={condition.id} className="cursor-grab">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          {condition.name}
                        </CardTitle>
                        <Code className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardDescription className="text-xs">
                        {condition.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="triggers" className="space-y-2 mt-2">
                {availableComponents.triggers.map((trigger) => (
                  <Card key={trigger.id} className="cursor-grab">
                    <CardHeader className="p-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          {trigger.name}
                        </CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardDescription className="text-xs">
                        {trigger.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-muted/20 overflow-auto">
          <div className="absolute inset-0 p-4">
            {/* This would be replaced with a proper canvas implementation */}
            <div className="relative w-full h-full">
              {workflow.nodes.map((node) => (
                <div
                  key={node.id}
                  className="absolute p-2 bg-background border rounded-md shadow-sm cursor-pointer"
                  style={{
                    left: `${node.position.x}px`,
                    top: `${node.position.y}px`,
                    minWidth: "150px",
                  }}
                  onClick={() => handleNodeSelect(node)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      {getNodeIcon(node.type)}
                      <span className="ml-2 font-medium text-sm">
                        {node.name}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {node.type}
                    </Badge>
                  </div>
                  {node.description && (
                    <p className="text-xs text-muted-foreground">
                      {node.description}
                    </p>
                  )}
                </div>
              ))}

              {/* This would be replaced with proper connection lines */}
              {workflow.nodes.map((node) =>
                node.connections.map((targetId) => {
                  const target = workflow.nodes.find((n) => n.id === targetId);
                  if (!target) return null;

                  // Simple straight line connection - in a real implementation this would be SVG paths
                  return (
                    <div
                      key={`${node.id}-${targetId}`}
                      className="absolute bg-muted-foreground"
                      style={{
                        left: `${node.position.x + 75}px`,
                        top: `${node.position.y + 30}px`,
                        width: `${target.position.x - node.position.x - 75}px`,
                        height: "2px",
                      }}
                    />
                  );
                }),
              )}

              {/* Add node button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-4 right-4 rounded-full shadow-md"
                      onClick={() => setIsAddNodeDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add new node</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        {isPropertiesOpen && selectedNode && (
          <div className="w-80 border-l bg-background p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Node Properties</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPropertiesOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <div className="flex items-center mt-1">
                  {getNodeIcon(selectedNode.type)}
                  <span className="ml-2 capitalize">{selectedNode.type}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={selectedNode.name}
                  onChange={(e) => {
                    // In a real implementation, this would update the node
                  }}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={selectedNode.description || ""}
                  onChange={(e) => {
                    // In a real implementation, this would update the node
                  }}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Position</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="text-xs text-muted-foreground">X</label>
                    <Input
                      type="number"
                      value={selectedNode.position.x}
                      onChange={(e) => {
                        // In a real implementation, this would update the node
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Y</label>
                    <Input
                      type="number"
                      value={selectedNode.position.y}
                      onChange={(e) => {
                        // In a real implementation, this would update the node
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Connections</label>
                <div className="mt-1 space-y-2">
                  {selectedNode.connections.length > 0 ? (
                    selectedNode.connections.map((connectionId) => {
                      const connectedNode = workflow.nodes.find(
                        (n) => n.id === connectionId,
                      );
                      return connectedNode ? (
                        <div
                          key={connectionId}
                          className="flex items-center justify-between bg-muted p-2 rounded-md"
                        >
                          <div className="flex items-center">
                            {getNodeIcon(connectedNode.type)}
                            <span className="ml-2 text-sm">
                              {connectedNode.name}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null;
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No connections
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <PlusCircle className="h-4 w-4 mr-2" /> Add Connection
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between">
                <Button variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-2" /> Duplicate
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Node Dialog */}
      <Dialog open={isAddNodeDialogOpen} onOpenChange={setIsAddNodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Node</DialogTitle>
            <DialogDescription>
              Select the type of node you want to add to your workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-medium">Node Type</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select node type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="trigger">Trigger</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-medium">Component</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select component" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="component-1">
                    Customer Service Agent
                  </SelectItem>
                  <SelectItem value="component-2">
                    Technical Support Agent
                  </SelectItem>
                  <SelectItem value="component-3">Sales Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddNodeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => handleAddNode("agent", "component-1")}>
              Add Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowBuilder;
