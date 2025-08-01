'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Settings, 
  Zap, 
  Brain, 
  TestTube, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Database,
  MessageSquare,
  Cpu,
  Shield
} from 'lucide-react';
import { AgentType, AgentConfiguration, AgentWizardData, AgentWizardStep } from '@/lib/agents/types';
import { AgentService } from '@/lib/agents/agent-service';

interface AgentCreationWizardProps {
  onComplete?: (agent: any) => void;
  onCancel?: () => void;
  initialData?: Partial<AgentConfiguration>;
}

const WIZARD_STEPS: AgentWizardStep[] = [
  {
    id: 'type',
    title: 'Agent Type',
    description: 'Choose the type of agent you want to create',
    component: 'TypeSelection',
    isCompleted: false,
    isRequired: true
  },
  {
    id: 'basic',
    title: 'Basic Configuration',
    description: 'Set up basic agent information',
    component: 'BasicConfig',
    isCompleted: false,
    isRequired: true
  },
  {
    id: 'model',
    title: 'AI Model Selection',
    description: 'Choose AI model and provider settings',
    component: 'ModelConfig',
    isCompleted: false,
    isRequired: true
  },
  {
    id: 'capabilities',
    title: 'Capabilities',
    description: 'Configure agent capabilities and tools',
    component: 'CapabilitiesConfig',
    isCompleted: false,
    isRequired: true
  },
  {
    id: 'memory',
    title: 'Memory Settings',
    description: 'Configure memory and session management',
    component: 'MemoryConfig',
    isCompleted: false,
    isRequired: false
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    description: 'Set up agent-to-agent collaboration',
    component: 'CollaborationConfig',
    isCompleted: false,
    isRequired: false
  },
  {
    id: 'test',
    title: 'Test & Debug',
    description: 'Test your agent configuration',
    component: 'TestConfig',
    isCompleted: false,
    isRequired: true
  },
  {
    id: 'review',
    title: 'Review & Deploy',
    description: 'Review and deploy your agent',
    component: 'ReviewConfig',
    isCompleted: false,
    isRequired: true
  }
];

const AGENT_TEMPLATES = [
  {
    id: 'customer-support',
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries and support tickets',
    type: AgentType.TOOL_DRIVEN,
    category: 'Support',
    icon: MessageSquare,
    config: {
      systemPrompt: 'You are a helpful customer support agent. Assist customers with their inquiries professionally and efficiently.',
      temperature: 0.3,
      tools: ['knowledge-search', 'ticket-creation', 'email-sender']
    }
  },
  {
    id: 'data-analyst',
    name: 'Data Analysis Agent',
    description: 'Analyzes data and generates insights',
    type: AgentType.HYBRID,
    category: 'Analytics',
    icon: Database,
    config: {
      systemPrompt: 'You are a data analyst. Analyze data, identify patterns, and provide actionable insights.',
      temperature: 0.1,
      tools: ['database-query', 'chart-generator', 'report-builder']
    }
  },
  {
    id: 'content-creator',
    name: 'Content Creation Agent',
    description: 'Creates and optimizes content',
    type: AgentType.MULTI_PROVIDER,
    category: 'Content',
    icon: Sparkles,
    config: {
      systemPrompt: 'You are a creative content creator. Generate engaging, high-quality content tailored to the target audience.',
      temperature: 0.8,
      tools: ['image-generator', 'seo-optimizer', 'social-media-poster']
    }
  },
  {
    id: 'workflow-orchestrator',
    name: 'Workflow Orchestrator',
    description: 'Manages and coordinates complex workflows',
    type: AgentType.MULTI_TASK,
    category: 'Automation',
    icon: Cpu,
    config: {
      systemPrompt: 'You are a workflow orchestrator. Coordinate tasks, manage dependencies, and ensure efficient execution.',
      temperature: 0.2,
      tools: ['task-scheduler', 'notification-sender', 'status-tracker']
    }
  }
];

export default function AgentCreationWizard({ 
  onComplete, 
  onCancel, 
  initialData 
}: AgentCreationWizardProps) {
  const [wizardData, setWizardData] = useState<AgentWizardData>({
    currentStep: 0,
    steps: WIZARD_STEPS,
    data: initialData || {},
    isValid: false,
    errors: []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const agentService = new AgentService();

  useEffect(() => {
    loadAvailableResources();
  }, []);

  const loadAvailableResources = async () => {
    try {
      const [tools, skills] = await Promise.all([
        // Load available tools
        fetch('/api/tools').then(r => r.json()),
        // Load available skills
        agentService.getAvailableSkills()
      ]);
      setAvailableTools(tools);
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Failed to load resources:', error);
    }
  };

  const updateWizardData = (updates: Partial<AgentConfiguration>) => {
    setWizardData(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
      steps: prev.steps.map((step, index) => 
        index === prev.currentStep 
          ? { ...step, isCompleted: true }
          : step
      )
    }));
  };

  const nextStep = () => {
    if (wizardData.currentStep < wizardData.steps.length - 1) {
      setWizardData(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1
      }));
    }
  };

  const prevStep = () => {
    if (wizardData.currentStep > 0) {
      setWizardData(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1
      }));
    }
  };

  const handleTemplateSelect = (template: any) => {
    updateWizardData({
      ...template.config,
      type: template.type,
      name: template.name,
      description: template.description
    });
  };

  const testAgent = async () => {
    setIsLoading(true);
    try {
      const testInput = "Hello, can you help me with a test query?";
      const results = await agentService.testAgent('temp-agent', testInput);
      setTestResults(results);
    } catch (error) {
      setTestResults({ error: error instanceof Error ? error.message : 'Test failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const createAgent = async () => {
    setIsLoading(true);
    try {
      const agent = await agentService.createAgent(wizardData.data);
      onComplete?.(agent);
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStep = wizardData.steps[wizardData.currentStep];
  const progress = ((wizardData.currentStep + 1) / wizardData.steps.length) * 100;

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Agent</h1>
              <p className="text-gray-600 mt-1">Build and configure your AI agent step by step</p>
            </div>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Step {wizardData.currentStep + 1} of {wizardData.steps.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Navigation */}
          <div className="flex items-center space-x-2 mt-4 overflow-x-auto pb-2">
            {wizardData.steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap ${
                  index === wizardData.currentStep
                    ? 'bg-blue-100 text-blue-700'
                    : step.isCompleted
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {step.isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : index === wizardData.currentStep ? (
                  <div className="w-4 h-4 rounded-full bg-blue-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300" />
                )}
                <span className="text-sm font-medium">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {currentStep.id === 'type' && <Bot className="w-5 h-5" />}
              {currentStep.id === 'basic' && <Settings className="w-5 h-5" />}
              {currentStep.id === 'model' && <Brain className="w-5 h-5" />}
              {currentStep.id === 'capabilities' && <Zap className="w-5 h-5" />}
              {currentStep.id === 'memory' && <Database className="w-5 h-5" />}
              {currentStep.id === 'collaboration' && <MessageSquare className="w-5 h-5" />}
              {currentStep.id === 'test' && <TestTube className="w-5 h-5" />}
              {currentStep.id === 'review' && <Shield className="w-5 h-5" />}
              <span>{currentStep.title}</span>
            </CardTitle>
            <CardDescription>{currentStep.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Type Selection Step */}
            {currentStep.id === 'type' && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Choose Agent Type</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    {Object.values(AgentType).map((type) => (
                      <Card
                        key={type}
                        className={`cursor-pointer transition-all ${
                          wizardData.data.type === type
                            ? 'ring-2 ring-blue-500 bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => updateWizardData({ type })}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Bot className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium">{type.replace('_', ' ')}</h3>
                              <p className="text-sm text-gray-600">
                                {type === AgentType.STANDALONE && 'Independent agent with no external dependencies'}
                                {type === AgentType.TOOL_DRIVEN && 'Agent that primarily uses tools to accomplish tasks'}
                                {type === AgentType.HYBRID && 'Combines conversational AI with tool execution'}
                                {type === AgentType.MULTI_TASK && 'Handles multiple concurrent tasks'}
                                {type === AgentType.MULTI_PROVIDER && 'Uses multiple AI providers with fallback'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base font-medium">Or Start from Template</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    {AGENT_TEMPLATES.map((template) => {
                      const IconComponent = template.icon;
                      return (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:bg-gray-50 transition-all"
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <IconComponent className="w-5 h-5 text-purple-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-medium">{template.name}</h3>
                                  <Badge variant="secondary">{template.category}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Basic Configuration Step */}
            {currentStep.id === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter agent name"
                      value={wizardData.data.name || ''}
                      onChange={(e) => updateWizardData({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="Brief description of the agent"
                      value={wizardData.data.description || ''}
                      onChange={(e) => updateWizardData({ description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">System Prompt *</Label>
                  <Textarea
                    id="systemPrompt"
                    placeholder="Define the agent's role, personality, and behavior..."
                    rows={6}
                    value={wizardData.data.systemPrompt || ''}
                    onChange={(e) => updateWizardData({ systemPrompt: e.target.value })}
                  />
                  <p className="text-sm text-gray-600">
                    This prompt defines how your agent behaves and responds to users.
                  </p>
                </div>
              </div>
            )}

            {/* Model Configuration Step */}
            {currentStep.id === 'model' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="provider">AI Provider</Label>
                    <Select
                      value={wizardData.data.provider || ''}
                      onValueChange={(value) => updateWizardData({ provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                        <SelectItem value="google">Google (Gemini)</SelectItem>
                        <SelectItem value="mistral">Mistral</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Select
                      value={wizardData.data.model || ''}
                      onValueChange={(value) => updateWizardData({ model: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                        <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={wizardData.data.temperature || 0.7}
                      onChange={(e) => updateWizardData({ temperature: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-gray-600">Controls randomness (0-2)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Max Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min="1"
                      max="8192"
                      value={wizardData.data.maxTokens || 2048}
                      onChange={(e) => updateWizardData({ maxTokens: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-gray-600">Maximum response length</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeout">Timeout (seconds)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min="1"
                      max="300"
                      value={wizardData.data.timeout || 30}
                      onChange={(e) => updateWizardData({ timeout: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-gray-600">Request timeout</p>
                  </div>
                </div>
              </div>
            )}

            {/* Capabilities Configuration Step */}
            {currentStep.id === 'capabilities' && (
              <div className="space-y-6">
                <Tabs defaultValue="tools" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="tools">Tools</TabsTrigger>
                    <TabsTrigger value="skills">Skills</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="tools" className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">Available Tools</Label>
                      <p className="text-sm text-gray-600 mb-4">
                        Select tools that your agent can use to accomplish tasks.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                        {availableTools.map((tool) => (
                          <div
                            key={tool.id}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                          >
                            <Switch
                              checked={wizardData.data.tools?.includes(tool.id) || false}
                              onCheckedChange={(checked) => {
                                const currentTools = wizardData.data.tools || [];
                                const newTools = checked
                                  ? [...currentTools, tool.id]
                                  : currentTools.filter(id => id !== tool.id);
                                updateWizardData({ tools: newTools });
                              }}
                            />
                            <div className="flex-1">
                              <h4 className="font-medium">{tool.name}</h4>
                              <p className="text-sm text-gray-600">{tool.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="skills" className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">Available Skills</Label>
                      <p className="text-sm text-gray-600 mb-4">
                        Select pre-built skills to enhance your agent's capabilities.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                        {availableSkills.map((skill) => (
                          <div
                            key={skill.id}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                          >
                            <Switch
                              checked={wizardData.data.skills?.includes(skill.id) || false}
                              onCheckedChange={(checked) => {
                                const currentSkills = wizardData.data.skills || [];
                                const newSkills = checked
                                  ? [...currentSkills, skill.id]
                                  : currentSkills.filter(id => id !== skill.id);
                                updateWizardData({ skills: newSkills });
                              }}
                            />
                            <div className="flex-1">
                              <h4 className="font-medium">{skill.name}</h4>
                              <p className="text-sm text-gray-600">{skill.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Memory Configuration Step */}
            {currentStep.id === 'memory' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Enable Memory</Label>
                      <p className="text-sm text-gray-600">Allow agent to remember conversation context</p>
                    </div>
                    <Switch
                      checked={wizardData.data.memorySettings?.enabled || false}
                      onCheckedChange={(enabled) => 
                        updateWizardData({
                          memorySettings: {
                            ...wizardData.data.memorySettings,
                            enabled
                          }
                        })
                      }
                    />
                  </div>

                  {wizardData.data.memorySettings?.enabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxSize">Max Memory Size (MB)</Label>
                          <Input
                            id="maxSize"
                            type="number"
                            min="1"
                            max="1000"
                            value={wizardData.data.memorySettings?.maxSize || 100}
                            onChange={(e) => 
                              updateWizardData({
                                memorySettings: {
                                  ...wizardData.data.memorySettings,
                                  maxSize: parseInt(e.target.value)
                                }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pruningStrategy">Pruning Strategy</Label>
                          <Select
                            value={wizardData.data.memorySettings?.pruningStrategy || 'intelligent'}
                            onValueChange={(value) => 
                              updateWizardData({
                                memorySettings: {
                                  ...wizardData.data.memorySettings,
                                  pruningStrategy: value as 'fifo' | 'lru' | 'intelligent'
                                }
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fifo">First In, First Out</SelectItem>
                              <SelectItem value="lru">Least Recently Used</SelectItem>
                              <SelectItem value="intelligent">Intelligent Pruning</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Persistent Memory</Label>
                          <p className="text-sm text-gray-600">Retain memory across sessions</p>
                        </div>
                        <Switch
                          checked={wizardData.data.memorySettings?.persistentMemory || false}
                          onCheckedChange={(persistentMemory) => 
                            updateWizardData({
                              memorySettings: {
                                ...wizardData.data.memorySettings,
                                persistentMemory
                              }
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Collaboration Configuration Step */}
            {currentStep.id === 'collaboration' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Enable Agent-to-Agent Collaboration</Label>
                      <p className="text-sm text-gray-600">Allow this agent to communicate with other agents</p>
                    </div>
                    <Switch
                      checked={wizardData.data.collaborationSettings?.allowAgentToAgent || false}
                      onCheckedChange={(allowAgentToAgent) => 
                        updateWizardData({
                          collaborationSettings: {
                            ...wizardData.data.collaborationSettings,
                            allowAgentToAgent
                          }
                        })
                      }
                    />
                  </div>

                  {wizardData.data.collaborationSettings?.allowAgentToAgent && (
                    <div className="space-y-4 pl-4 border-l-2 border-green-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxCollaborators">Max Collaborators</Label>
                          <Input
                            id="maxCollaborators"
                            type="number"
                            min="1"
                            max="10"
                            value={wizardData.data.collaborationSettings?.maxCollaborators || 3}
                            onChange={(e) => 
                              updateWizardData({
                                collaborationSettings: {
                                  ...wizardData.data.collaborationSettings,
                                  maxCollaborators: parseInt(e.target.value)
                                }
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Share Memory</Label>
                          <p className="text-sm text-gray-600">Share memory context with collaborating agents</p>
                        </div>
                        <Switch
                          checked={wizardData.data.collaborationSettings?.shareMemory || false}
                          onCheckedChange={(shareMemory) => 
                            updateWizardData({
                              collaborationSettings: {
                                ...wizardData.data.collaborationSettings,
                                shareMemory
                              }
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test Configuration Step */}
            {currentStep.id === 'test' && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Test Your Agent</Label>
                  <p className="text-sm text-gray-600 mb-4">
                    Test your agent configuration with a sample input to ensure it works as expected.
                  </p>
                  
                  <div className="space-y-4">
                    <Button 
                      onClick={testAgent} 
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Testing...' : 'Run Test'}
                    </Button>

                    {testResults && (
                      <div className="space-y-3">
                        {testResults.error ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Test failed: {testResults.error}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>
                              Test completed successfully! Your agent is ready to deploy.
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <Label className="text-sm font-medium">Test Results:</Label>
                          <pre className="text-sm mt-2 whitespace-pre-wrap">
                            {JSON.stringify(testResults, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Review Configuration Step */}
            {currentStep.id === 'review' && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Review Configuration</Label>
                  <p className="text-sm text-gray-600 mb-4">
                    Review your agent configuration before deployment.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium mb-2">Agent Summary</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <span className="ml-2 font-medium">{wizardData.data.name || 'Unnamed Agent'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <span className="ml-2 font-medium">{wizardData.data.type || 'Not selected'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Model:</span>
                          <span className="ml-2 font-medium">{wizardData.data.model || 'Not selected'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Provider:</span>
                          <span className="ml-2 font-medium">{wizardData.data.provider || 'Not selected'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Tools:</span>
                          <span className="ml-2 font-medium">{wizardData.data.tools?.length || 0} selected</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Skills:</span>
                          <span className="ml-2 font-medium">{wizardData.data.skills?.length || 0} selected</span>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={createAgent} 
                      disabled={isLoading}
                      className="w-full"
                      size="lg"
                    >
                      {isLoading ? 'Creating Agent...' : 'Create Agent'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={wizardData.currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <Button
            onClick={nextStep}
            disabled={wizardData.currentStep === wizardData.steps.length - 1}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}