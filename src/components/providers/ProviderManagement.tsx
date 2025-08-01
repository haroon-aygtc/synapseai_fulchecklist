import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Settings, 
  Activity, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Zap,
  Shield,
  BarChart3,
  RefreshCw,
  Trash2,
  Edit,
  TestTube,
  Eye,
  EyeOff
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  type: string;
  endpoint?: string;
  capabilities: string[];
  isActive: boolean;
  priority: number;
  rateLimit?: number;
  costPerToken?: number;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  avgResponseTime?: number;
  successRate?: number;
  totalRequests: number;
  totalErrors: number;
  lastUsedAt?: string;
  lastHealthCheck?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProviderAnalytics {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  dailyMetrics: Array<{
    date: string;
    requests: number;
    errors: number;
    cost: number;
    avgLatency: number;
  }>;
  performanceScore: number;
  healthScore: number;
  costEfficiencyScore: number;
}

const PROVIDER_TYPES = [
  { value: 'OPENAI', label: 'OpenAI', icon: '🤖' },
  { value: 'ANTHROPIC', label: 'Anthropic (Claude)', icon: '🧠' },
  { value: 'GOOGLE', label: 'Google (Gemini)', icon: '🔍' },
  { value: 'MISTRAL', label: 'Mistral AI', icon: '🌪️' },
  { value: 'GROQ', label: 'Groq', icon: '⚡' },
  { value: 'DEEPSEEK', label: 'DeepSeek', icon: '🔬' },
  { value: 'HUGGINGFACE', label: 'Hugging Face', icon: '🤗' },
  { value: 'OPENROUTER', label: 'OpenRouter', icon: '🛣️' },
  { value: 'OLLAMA', label: 'Ollama', icon: '🦙' },
  { value: 'LOCALAI', label: 'LocalAI', icon: '🏠' },
  { value: 'CUSTOM', label: 'Custom', icon: '⚙️' }
];

const CAPABILITIES = [
  'chat', 'completion', 'embedding', 'function_calling', 'vision', 'code_generation', 'translation'
];

export default function ProviderManagement() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<any>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    endpoint: '',
    apiKey: '',
    capabilities: [] as string[],
    priority: 50,
    rateLimit: 1000,
    costPerToken: 0.001,
    config: '{}'
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/providers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderAnalytics = async (providerId: string) => {
    try {
      const response = await fetch(`/api/providers/${providerId}/analytics`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const createProvider = async () => {
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          config: JSON.parse(formData.config || '{}')
        })
      });

      if (response.ok) {
        setIsCreateDialogOpen(false);
        resetForm();
        fetchProviders();
      }
    } catch (error) {
      console.error('Error creating provider:', error);
    }
  };

  const updateProvider = async () => {
    if (!selectedProvider) return;

    try {
      const response = await fetch(`/api/providers/${selectedProvider.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          config: JSON.parse(formData.config || '{}')
        })
      });

      if (response.ok) {
        setIsEditDialogOpen(false);
        resetForm();
        fetchProviders();
      }
    } catch (error) {
      console.error('Error updating provider:', error);
    }
  };

  const deleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;

    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        fetchProviders();
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const testProvider = async (providerId: string) => {
    try {
      setTestResults(null);
      const response = await fetch(`/api/providers/${providerId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: 'Hello, this is a test message.',
          maxTokens: 50
        })
      });

      const result = await response.json();
      setTestResults(result);
    } catch (error) {
      console.error('Error testing provider:', error);
      setTestResults({ success: false, error: error.message });
    }
  };

  const toggleProviderStatus = async (providerId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isActive })
      });

      if (response.ok) {
        fetchProviders();
      }
    } catch (error) {
      console.error('Error toggling provider status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      endpoint: '',
      apiKey: '',
      capabilities: [],
      priority: 50,
      rateLimit: 1000,
      costPerToken: 0.001,
      config: '{}'
    });
  };

  const openEditDialog = (provider: Provider) => {
    setSelectedProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      endpoint: provider.endpoint || '',
      apiKey: '', // Don't populate for security
      capabilities: provider.capabilities,
      priority: provider.priority,
      rateLimit: provider.rateLimit || 1000,
      costPerToken: provider.costPerToken || 0.001,
      config: JSON.stringify(provider.metadata || {}, null, 2)
    });
    setIsEditDialogOpen(true);
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'bg-green-500';
      case 'DEGRADED': return 'bg-yellow-500';
      case 'UNHEALTHY': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'DEGRADED': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'UNHEALTHY': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider Management</h1>
            <p className="text-gray-600 mt-1">Manage AI providers, routing, and analytics</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Provider
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Providers</p>
                  <p className="text-2xl font-bold">{providers.length}</p>
                </div>
                <Settings className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Providers</p>
                  <p className="text-2xl font-bold text-green-600">
                    {providers.filter(p => p.isActive).length}
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
                  <p className="text-sm font-medium text-gray-600">Healthy Providers</p>
                  <p className="text-2xl font-bold text-green-600">
                    {providers.filter(p => p.healthStatus === 'HEALTHY').length}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold">
                    {formatNumber(providers.reduce((sum, p) => sum + p.totalRequests, 0))}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Providers List */}
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>Manage your AI provider configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {providers.map((provider) => (
                <div key={provider.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">
                          {PROVIDER_TYPES.find(t => t.value === provider.type)?.icon || '⚙️'}
                        </span>
                        <div>
                          <h3 className="font-semibold">{provider.name}</h3>
                          <p className="text-sm text-gray-600">{provider.type}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {getHealthStatusIcon(provider.healthStatus)}
                        <Badge variant={provider.isActive ? 'default' : 'secondary'}>
                          {provider.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">Priority: {provider.priority}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right text-sm">
                        <p className="font-medium">{formatNumber(provider.totalRequests)} requests</p>
                        <p className="text-gray-600">
                          {provider.avgResponseTime ? `${provider.avgResponseTime.toFixed(0)}ms avg` : 'No data'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProvider(provider);
                            fetchProviderAnalytics(provider.id);
                          }}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProvider(provider);
                            setIsTestDialogOpen(true);
                          }}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(provider)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={provider.isActive}
                          onCheckedChange={(checked) => toggleProviderStatus(provider.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProvider(provider.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Provider Details */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.capabilities.map((capability) => (
                      <Badge key={capability} variant="outline" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Success Rate</p>
                      <p className="font-medium">
                        {provider.successRate ? `${(provider.successRate * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Cost/Token</p>
                      <p className="font-medium">
                        {provider.costPerToken ? formatCurrency(provider.costPerToken) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Rate Limit</p>
                      <p className="font-medium">{provider.rateLimit || 'Unlimited'}/min</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Last Used</p>
                      <p className="font-medium">
                        {provider.lastUsedAt 
                          ? new Date(provider.lastUsedAt).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Analytics Panel */}
        {selectedProvider && analytics && (
          <Card>
            <CardHeader>
              <CardTitle>Analytics - {selectedProvider.name}</CardTitle>
              <CardDescription>Performance metrics and insights</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="costs">Costs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{analytics.performanceScore.toFixed(0)}</p>
                          <p className="text-sm text-gray-600">Performance Score</p>
                          <Progress value={analytics.performanceScore} className="mt-2" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{analytics.healthScore.toFixed(0)}</p>
                          <p className="text-sm text-gray-600">Health Score</p>
                          <Progress value={analytics.healthScore} className="mt-2" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-purple-600">{analytics.costEfficiencyScore.toFixed(0)}</p>
                          <p className="text-sm text-gray-600">Cost Efficiency</p>
                          <Progress value={analytics.costEfficiencyScore} className="mt-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="performance" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Response Time</h4>
                        <p className="text-2xl font-bold">{analytics.avgLatency.toFixed(0)}ms</p>
                        <p className="text-sm text-gray-600">Average latency</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Success Rate</h4>
                        <p className="text-2xl font-bold text-green-600">
                          {(analytics.successRate * 100).toFixed(1)}%
                        </p>
                        <p className="text-sm text-gray-600">
                          {analytics.totalRequests - analytics.totalErrors} / {analytics.totalRequests} requests
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="costs" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Total Cost</h4>
                        <p className="text-2xl font-bold">{formatCurrency(analytics.totalCost)}</p>
                        <p className="text-sm text-gray-600">Last 30 days</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Cost per Request</h4>
                        <p className="text-2xl font-bold">
                          {formatCurrency(analytics.totalCost / analytics.totalRequests || 0)}
                        </p>
                        <p className="text-sm text-gray-600">Average cost</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Create Provider Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Provider</DialogTitle>
              <DialogDescription>Configure a new AI provider for your organization</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Provider Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My OpenAI Provider"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Provider Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="endpoint">Endpoint (Optional)</Label>
                <Input
                  id="endpoint"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="priority">Priority (0-100)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="rateLimit">Rate Limit (per minute)</Label>
                  <Input
                    id="rateLimit"
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="costPerToken">Cost per Token</Label>
                  <Input
                    id="costPerToken"
                    type="number"
                    step="0.000001"
                    value={formData.costPerToken}
                    onChange={(e) => setFormData({ ...formData, costPerToken: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Capabilities</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CAPABILITIES.map((capability) => (
                    <Badge
                      key={capability}
                      variant={formData.capabilities.includes(capability) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const newCapabilities = formData.capabilities.includes(capability)
                          ? formData.capabilities.filter(c => c !== capability)
                          : [...formData.capabilities, capability];
                        setFormData({ ...formData, capabilities: newCapabilities });
                      }}
                    >
                      {capability}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="config">Configuration (JSON)</Label>
                <Textarea
                  id="config"
                  value={formData.config}
                  onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                  placeholder="{}"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createProvider}>Create Provider</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Provider Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Provider</DialogTitle>
              <DialogDescription>Update provider configuration</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Same form fields as create dialog */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Provider Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-type">Provider Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={updateProvider}>Update Provider</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Test Provider Dialog */}
        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Provider</DialogTitle>
              <DialogDescription>
                Test the connection and functionality of {selectedProvider?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {testResults && (
                <Alert className={testResults.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <AlertDescription>
                    {testResults.success ? (
                      <div>
                        <p className="font-medium text-green-800">✅ Test successful!</p>
                        <p className="text-sm text-green-700 mt-1">
                          Response time: {testResults.duration}ms
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-red-800">❌ Test failed</p>
                        <p className="text-sm text-red-700 mt-1">{testResults.error}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                  Close
                </Button>
                <Button 
                  onClick={() => selectedProvider && testProvider(selectedProvider.id)}
                  disabled={!selectedProvider}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Run Test
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}