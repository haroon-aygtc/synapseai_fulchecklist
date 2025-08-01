/**
 * Provider Management Component
 * 
 * Comprehensive interface for managing AI providers with smart routing,
 * configuration, testing, and monitoring capabilities.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Settings, 
  Activity, 
  Clock,
  DollarSign,
  Zap,
  Shield,
  Globe,
  TestTube,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
  Edit,
  Trash2,
  Copy,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Target,
  Route,
  Gauge
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  type: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'MISTRAL' | 'GROQ' | 'DEEPSEEK' | 'HUGGINGFACE' | 'OPENROUTER' | 'OLLAMA' | 'LOCALAI' | 'CUSTOM';
  endpoint?: string;
  apiKey?: string;
  config: Record<string, any>;
  capabilities: string[];
  isActive: boolean;
  priority: number;
  rateLimit?: number;
  costPerToken?: number;
  metadata: {
    totalRequests: number;
    totalErrors: number;
    avgLatency: number;
    successRate: number;
    lastUsed?: Date;
  };
  routingRules: ProviderRoutingRule[];
  usageMetrics: ProviderUsageMetric[];
}

interface ProviderRoutingRule {
  id: string;
  condition: Record<string, any>;
  priority: number;
  fallback: boolean;
  isActive: boolean;
}

interface ProviderUsageMetric {
  id: string;
  date: Date;
  requests: number;
  tokens: number;
  cost: number;
  errors: number;
  avgLatency: number;
}

interface ProviderManagementProps {
  className?: string;
  organizationId: string;
}

const PROVIDER_TYPES = [
  { value: 'OPENAI', label: 'OpenAI', icon: '🤖', description: 'GPT-4, GPT-3.5, and other OpenAI models' },
  { value: 'ANTHROPIC', label: 'Anthropic', icon: '🧠', description: 'Claude models for advanced reasoning' },
  { value: 'GOOGLE', label: 'Google', icon: '🔍', description: 'Gemini and PaLM models' },
  { value: 'MISTRAL', label: 'Mistral', icon: '🌪️', description: 'Open-source and commercial Mistral models' },
  { value: 'GROQ', label: 'Groq', icon: '⚡', description: 'Ultra-fast inference with Groq chips' },
  { value: 'DEEPSEEK', label: 'DeepSeek', icon: '🔬', description: 'Advanced coding and reasoning models' },
  { value: 'HUGGINGFACE', label: 'Hugging Face', icon: '🤗', description: 'Open-source models via Hugging Face' },
  { value: 'OPENROUTER', label: 'OpenRouter', icon: '🛣️', description: 'Access to multiple models via OpenRouter' },
  { value: 'OLLAMA', label: 'Ollama', icon: '🦙', description: 'Local models via Ollama' },
  { value: 'LOCALAI', label: 'LocalAI', icon: '🏠', description: 'Self-hosted AI models' },
  { value: 'CUSTOM', label: 'Custom', icon: '⚙️', description: 'Custom API endpoints' }
];

const ROUTING_STRATEGIES = [
  { value: 'cost', label: 'Cost Optimized', description: 'Route to the cheapest available provider' },
  { value: 'latency', label: 'Latency Optimized', description: 'Route to the fastest provider' },
  { value: 'quality', label: 'Quality Optimized', description: 'Route to the highest quality provider' },
  { value: 'balanced', label: 'Balanced', description: 'Balance cost, latency, and quality' }
];

export default function ProviderManagement({ className = '', organizationId }: ProviderManagementProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [routingStrategy, setRoutingStrategy] = useState('balanced');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  
  const [newProvider, setNewProvider] = useState({
    name: '',
    type: 'OPENAI' as Provider['type'],
    endpoint: '',
    apiKey: '',
    config: {},
    capabilities: [] as string[],
    priority: 0,
    rateLimit: undefined as number | undefined,
    costPerToken: undefined as number | undefined
  });

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, [organizationId]);

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/providers?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createProvider = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProvider,
          organizationId
        })
      });

      if (response.ok) {
        const provider = await response.json();
        setProviders(prev => [...prev, provider]);
        setShowCreateDialog(false);
        resetNewProvider();
      }
    } catch (error) {
      console.error('Failed to create provider:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const updateProvider = async (providerId: string, updates: Partial<Provider>) => {
    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedProvider = await response.json();
        setProviders(prev => prev.map(p => p.id === providerId ? updatedProvider : p));
        if (selectedProvider?.id === providerId) {
          setSelectedProvider(updatedProvider);
        }
      }
    } catch (error) {
      console.error('Failed to update provider:', error);
    }
  };

  const deleteProvider = async (providerId: string) => {
    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setProviders(prev => prev.filter(p => p.id !== providerId));
        if (selectedProvider?.id === providerId) {
          setSelectedProvider(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete provider:', error);
    }
  };

  const testProvider = async (provider: Provider) => {
    setIsTesting(true);
    try {
      const response = await fetch(`/api/providers/${provider.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, this is a test message. Please respond briefly.' }
          ]
        })
      });

      const result = await response.json();
      setTestResults(prev => ({ ...prev, [provider.id]: result }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [provider.id]: { 
          success: false, 
          error: error.message 
        } 
      }));
    } finally {
      setIsTesting(false);
    }
  };

  const resetNewProvider = () => {
    setNewProvider({
      name: '',
      type: 'OPENAI',
      endpoint: '',
      apiKey: '',
      config: {},
      capabilities: [],
      priority: 0,
      rateLimit: undefined,
      costPerToken: undefined
    });
  };

  const getProviderIcon = (type: Provider['type']) => {
    const providerType = PROVIDER_TYPES.find(pt => pt.value === type);
    return providerType?.icon || '⚙️';
  };

  const getProviderStatusColor = (provider: Provider) => {
    if (!provider.isActive) return 'text-gray-500';
    if (provider.metadata.successRate > 95) return 'text-green-500';
    if (provider.metadata.successRate > 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 500) return 'text-green-600';
    if (latency < 1000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`bg-white ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Provider Management</h2>
            <p className="text-gray-600">Configure and monitor AI providers with smart routing</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={loadProviders}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Provider
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Provider</DialogTitle>
                  <DialogDescription>
                    Configure a new AI provider for your organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider-name">Provider Name</Label>
                      <Input
                        id="provider-name"
                        value={newProvider.name}
                        onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="My OpenAI Provider"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="provider-type">Provider Type</Label>
                      <Select
                        value={newProvider.type}
                        onValueChange={(value) => setNewProvider(prev => ({ ...prev, type: value as Provider['type'] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      value={newProvider.apiKey}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Enter API key"
                    />
                  </div>

                  {(newProvider.type === 'OLLAMA' || newProvider.type === 'LOCALAI' || newProvider.type === 'CUSTOM') && (
                    <div className="space-y-2">
                      <Label htmlFor="endpoint">Endpoint URL</Label>
                      <Input
                        id="endpoint"
                        value={newProvider.endpoint}
                        onChange={(e) => setNewProvider(prev => ({ ...prev, endpoint: e.target.value }))}
                        placeholder="https://api.example.com/v1"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Input
                        id="priority"
                        type="number"
                        value={newProvider.priority}
                        onChange={(e) => setNewProvider(prev => ({ ...prev, priority: Number(e.target.value) }))}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate-limit">Rate Limit (req/min)</Label>
                      <Input
                        id="rate-limit"
                        type="number"
                        value={newProvider.rateLimit || ''}
                        onChange={(e) => setNewProvider(prev => ({ 
                          ...prev, 
                          rateLimit: e.target.value ? Number(e.target.value) : undefined 
                        }))}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost-per-token">Cost per Token</Label>
                      <Input
                        id="cost-per-token"
                        type="number"
                        step="0.0001"
                        value={newProvider.costPerToken || ''}
                        onChange={(e) => setNewProvider(prev => ({ 
                          ...prev, 
                          costPerToken: e.target.value ? Number(e.target.value) : undefined 
                        }))}
                        placeholder="0.0001"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createProvider}
                      disabled={isCreating || !newProvider.name || !newProvider.apiKey}
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Provider'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Smart Routing Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Smart Routing Configuration
            </CardTitle>
            <CardDescription>
              Configure how requests are routed across your providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Routing Strategy</Label>
                  <Select value={routingStrategy} onValueChange={setRoutingStrategy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUTING_STRATEGIES.map(strategy => (
                        <SelectItem key={strategy.value} value={strategy.value}>
                          <div>
                            <div className="font-medium">{strategy.label}</div>
                            <div className="text-sm text-gray-600">{strategy.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm">
                  <div className="font-medium mb-2">Active Providers by Priority</div>
                  <div className="space-y-1">
                    {providers
                      .filter(p => p.isActive)
                      .sort((a, b) => b.priority - a.priority)
                      .slice(0, 5)
                      .map(provider => (
                        <div key={provider.id} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <span>{getProviderIcon(provider.type)}</span>
                            {provider.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Priority {provider.priority}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map(provider => (
            <Card key={provider.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getProviderIcon(provider.type)}</span>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription>{provider.type}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {provider.isActive ? (
                      <CheckCircle className={`h-4 w-4 ${getProviderStatusColor(provider)}`} />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <Switch
                      checked={provider.isActive}
                      onCheckedChange={(checked) => updateProvider(provider.id, { isActive: checked })}
                      size="sm"
                    />
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">
                      {provider.metadata.totalRequests.toLocaleString()}
                    </div>
                    <div className="text-gray-600">Requests</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-semibold ${getLatencyColor(provider.metadata.avgLatency)}`}>
                      {Math.round(provider.metadata.avgLatency)}ms
                    </div>
                    <div className="text-gray-600">Avg Latency</div>
                  </div>
                </div>

                {/* Success Rate */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span className={getProviderStatusColor(provider)}>
                      {provider.metadata.successRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={provider.metadata.successRate} 
                    className="h-2"
                  />
                </div>

                {/* Cost */}
                {provider.costPerToken && (
                  <div className="flex justify-between text-sm">
                    <span>Cost per Token</span>
                    <span className="font-medium">
                      {formatCurrency(provider.costPerToken)}
                    </span>
                  </div>
                )}

                {/* Priority */}
                <div className="flex justify-between text-sm">
                  <span>Priority</span>
                  <Badge variant="outline">
                    {provider.priority}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testProvider(provider)}
                    disabled={isTesting}
                    className="flex-1"
                  >
                    {isTesting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <TestTube className="h-3 w-3" />
                    )}
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedProvider(provider);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteProvider(provider.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Test Results */}
                {testResults[provider.id] && (
                  <Alert className="mt-2">
                    {testResults[provider.id].success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription className="text-xs">
                      {testResults[provider.id].success 
                        ? `Test successful (${testResults[provider.id].duration}ms)`
                        : `Test failed: ${testResults[provider.id].error}`
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {providers.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Providers Configured</h3>
              <p className="text-gray-600 mb-4">
                Add your first AI provider to start using SynapseAI
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}