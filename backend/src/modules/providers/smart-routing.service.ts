import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { Provider, ProviderType, ProviderHealthStatus } from '@prisma/client';
import { ExecuteProviderDto, SmartRoutingPreferencesDto } from './dto/provider.dto';

export interface RoutingDecision {
  selectedProvider: Provider;
  score: number;
  reasoning: string[];
  fallbackProviders: Provider[];
  estimatedCost: number;
  estimatedLatency: number;
}

export interface ProviderMetrics {
  avgLatency: number;
  successRate: number;
  costPerToken: number;
  currentLoad: number;
  healthScore: number;
  availabilityScore: number;
}

@Injectable()
export class SmartRoutingService {
  private readonly logger = new Logger(SmartRoutingService.name);
  private readonly routingCache = new Map<string, RoutingDecision>();
  private readonly metricsCache = new Map<string, ProviderMetrics>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.startMetricsUpdater();
  }

  /**
   * Select the optimal provider based on routing preferences and current metrics
   */
  async selectOptimalProvider(
    organizationId: string,
    request: ExecuteProviderDto,
    preferences?: SmartRoutingPreferencesDto
  ): Promise<RoutingDecision> {
    try {
      const cacheKey = this.generateCacheKey(organizationId, request, preferences);
      const cached = this.routingCache.get(cacheKey);
      
      // Return cached decision if still valid (within 30 seconds)
      if (cached && this.isCacheValid(cacheKey)) {
        return cached;
      }

      // Get eligible providers
      const eligibleProviders = await this.getEligibleProviders(organizationId, request, preferences);
      
      if (eligibleProviders.length === 0) {
        throw new Error('No eligible providers available');
      }

      // Calculate scores for each provider
      const scoredProviders = await Promise.all(
        eligibleProviders.map(async (provider) => {
          const metrics = await this.getProviderMetrics(provider.id);
          const score = this.calculateProviderScore(provider, metrics, request, preferences);
          return { provider, score, metrics };
        })
      );

      // Sort by score (highest first)
      scoredProviders.sort((a, b) => b.score - a.score);

      const selectedProvider = scoredProviders[0].provider;
      const selectedMetrics = scoredProviders[0].metrics;

      // Prepare fallback providers
      const fallbackProviders = scoredProviders
        .slice(1, 4) // Top 3 alternatives
        .map(sp => sp.provider);

      const decision: RoutingDecision = {
        selectedProvider,
        score: scoredProviders[0].score,
        reasoning: this.generateReasoning(selectedProvider, selectedMetrics, preferences),
        fallbackProviders,
        estimatedCost: this.estimateCost(selectedProvider, request),
        estimatedLatency: selectedMetrics.avgLatency
      };

      // Cache the decision
      this.routingCache.set(cacheKey, decision);
      setTimeout(() => this.routingCache.delete(cacheKey), 30000); // 30 second TTL

      return decision;
    } catch (error) {
      this.logger.error(`Error in smart routing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get providers eligible for the request
   */
  private async getEligibleProviders(
    organizationId: string,
    request: ExecuteProviderDto,
    preferences?: SmartRoutingPreferencesDto
  ): Promise<Provider[]> {
    const where: any = {
      organizationId,
      isActive: true,
      healthStatus: { not: ProviderHealthStatus.UNHEALTHY }
    };

    // Filter by preferred provider if specified
    if (preferences?.preferredProvider) {
      const preferredProvider = await this.prisma.provider.findFirst({
        where: { ...where, id: preferences.preferredProvider }
      });
      if (preferredProvider) {
        return [preferredProvider];
      }
    }

    // Get all eligible providers
    let providers = await this.prisma.provider.findMany({
      where,
      include: {
        usageMetrics: {
          take: 7,
          orderBy: { date: 'desc' }
        },
        healthChecks: {
          take: 5,
          orderBy: { checkedAt: 'desc' }
        }
      }
    });

    // Filter by required capabilities
    if (preferences?.requireCapabilities?.length) {
      providers = providers.filter(p => 
        preferences.requireCapabilities!.every(cap => p.capabilities.includes(cap))
      );
    }

    // Filter by cost constraints
    if (preferences?.maxCost) {
      providers = providers.filter(p => 
        !p.costPerToken || p.costPerToken <= preferences.maxCost!
      );
    }

    // Filter by latency constraints
    if (preferences?.maxLatency) {
      providers = providers.filter(p => 
        !p.avgResponseTime || p.avgResponseTime <= preferences.maxLatency!
      );
    }

    // Check circuit breakers and rate limits
    const availableProviders = [];
    for (const provider of providers) {
      if (await this.isProviderAvailable(provider.id)) {
        availableProviders.push(provider);
      }
    }

    return availableProviders;
  }

  /**
   * Calculate provider score based on multiple factors
   */
  private calculateProviderScore(
    provider: Provider,
    metrics: ProviderMetrics,
    request: ExecuteProviderDto,
    preferences?: SmartRoutingPreferencesDto
  ): number {
    const strategy = preferences?.strategy || 'balanced';
    
    // Base scores (0-100)
    const latencyScore = this.calculateLatencyScore(metrics.avgLatency);
    const costScore = this.calculateCostScore(metrics.costPerToken);
    const reliabilityScore = this.calculateReliabilityScore(metrics.successRate);
    const healthScore = metrics.healthScore;
    const availabilityScore = metrics.availabilityScore;
    const loadScore = this.calculateLoadScore(metrics.currentLoad);

    // Apply strategy weights
    let finalScore: number;
    switch (strategy) {
      case 'cost':
        finalScore = costScore * 0.6 + reliabilityScore * 0.2 + healthScore * 0.1 + availabilityScore * 0.1;
        break;
      case 'latency':
        finalScore = latencyScore * 0.6 + reliabilityScore * 0.2 + healthScore * 0.1 + availabilityScore * 0.1;
        break;
      case 'quality':
        finalScore = reliabilityScore * 0.5 + healthScore * 0.3 + latencyScore * 0.1 + availabilityScore * 0.1;
        break;
      case 'balanced':
      default:
        finalScore = (
          latencyScore * 0.25 +
          costScore * 0.2 +
          reliabilityScore * 0.25 +
          healthScore * 0.15 +
          availabilityScore * 0.1 +
          loadScore * 0.05
        );
        break;
    }

    // Apply priority bonus
    const priorityBonus = (provider.priority || 50) / 10; // 0-10 bonus
    finalScore += priorityBonus;

    // Apply model-specific bonuses
    if (request.model && this.supportsModel(provider, request.model)) {
      finalScore += 5;
    }

    // Apply capability bonuses
    if (request.tools && provider.capabilities.includes('function_calling')) {
      finalScore += 3;
    }

    return Math.min(100, Math.max(0, finalScore));
  }

  /**
   * Calculate latency score (lower latency = higher score)
   */
  private calculateLatencyScore(avgLatency: number): number {
    if (avgLatency <= 500) return 100;
    if (avgLatency <= 1000) return 80;
    if (avgLatency <= 2000) return 60;
    if (avgLatency <= 5000) return 40;
    if (avgLatency <= 10000) return 20;
    return 10;
  }

  /**
   * Calculate cost score (lower cost = higher score)
   */
  private calculateCostScore(costPerToken: number): number {
    if (costPerToken <= 0.0001) return 100;
    if (costPerToken <= 0.0005) return 80;
    if (costPerToken <= 0.001) return 60;
    if (costPerToken <= 0.005) return 40;
    if (costPerToken <= 0.01) return 20;
    return 10;
  }

  /**
   * Calculate reliability score based on success rate
   */
  private calculateReliabilityScore(successRate: number): number {
    return successRate * 100;
  }

  /**
   * Calculate load score (lower load = higher score)
   */
  private calculateLoadScore(currentLoad: number): number {
    if (currentLoad <= 0.2) return 100;
    if (currentLoad <= 0.4) return 80;
    if (currentLoad <= 0.6) return 60;
    if (currentLoad <= 0.8) return 40;
    if (currentLoad <= 0.9) return 20;
    return 10;
  }

  /**
   * Get current metrics for a provider
   */
  private async getProviderMetrics(providerId: string): Promise<ProviderMetrics> {
    const cached = this.metricsCache.get(providerId);
    if (cached) {
      return cached;
    }

    try {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        include: {
          usageMetrics: {
            take: 7,
            orderBy: { date: 'desc' }
          },
          healthChecks: {
            take: 10,
            orderBy: { checkedAt: 'desc' }
          }
        }
      });

      if (!provider) {
        throw new Error('Provider not found');
      }

      // Calculate metrics from recent data
      const recentMetrics = provider.usageMetrics;
      const recentHealthChecks = provider.healthChecks;

      const avgLatency = provider.avgResponseTime || 1000;
      const successRate = provider.successRate || 0;
      const costPerToken = provider.costPerToken || 0.001;

      // Calculate current load from Redis
      const currentLoad = await this.getCurrentLoad(providerId);

      // Calculate health score from recent health checks
      const healthScore = this.calculateHealthScore(recentHealthChecks);

      // Calculate availability score
      const availabilityScore = this.calculateAvailabilityScore(provider);

      const metrics: ProviderMetrics = {
        avgLatency,
        successRate,
        costPerToken,
        currentLoad,
        healthScore,
        availabilityScore
      };

      // Cache metrics for 60 seconds
      this.metricsCache.set(providerId, metrics);
      setTimeout(() => this.metricsCache.delete(providerId), 60000);

      return metrics;
    } catch (error) {
      this.logger.error(`Error getting provider metrics: ${error.message}`);
      // Return default metrics
      return {
        avgLatency: 2000,
        successRate: 0.5,
        costPerToken: 0.001,
        currentLoad: 0.5,
        healthScore: 50,
        availabilityScore: 50
      };
    }
  }

  /**
   * Get current load for a provider from Redis
   */
  private async getCurrentLoad(providerId: string): Promise<number> {
    try {
      const activeRequests = await this.redis.get(`provider:${providerId}:active_requests`);
      const maxConcurrency = await this.redis.get(`provider:${providerId}:max_concurrency`);
      
      const active = parseInt(activeRequests || '0');
      const max = parseInt(maxConcurrency || '100');
      
      return max > 0 ? active / max : 0;
    } catch (error) {
      return 0.5; // Default moderate load
    }
  }

  /**
   * Calculate health score from recent health checks
   */
  private calculateHealthScore(healthChecks: any[]): number {
    if (healthChecks.length === 0) return 50;

    const healthyCount = healthChecks.filter(hc => hc.status === 'HEALTHY').length;
    return (healthyCount / healthChecks.length) * 100;
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(provider: Provider): number {
    const now = new Date();
    const lastUsed = provider.lastUsedAt;
    const lastHealthCheck = provider.lastHealthCheck;

    let score = 100;

    // Penalize if not used recently
    if (lastUsed && now.getTime() - lastUsed.getTime() > 24 * 60 * 60 * 1000) {
      score -= 20; // -20 for not used in 24h
    }

    // Penalize if health check is stale
    if (lastHealthCheck && now.getTime() - lastHealthCheck.getTime() > 10 * 60 * 1000) {
      score -= 30; // -30 for stale health check (>10 min)
    }

    // Penalize based on circuit breaker status
    if (provider.circuitBreakerStatus === 'OPEN') {
      score -= 50;
    } else if (provider.circuitBreakerStatus === 'HALF_OPEN') {
      score -= 25;
    }

    return Math.max(0, score);
  }

  /**
   * Check if provider is currently available
   */
  private async isProviderAvailable(providerId: string): Promise<boolean> {
    try {
      // Check circuit breaker status
      const circuitBreakerStatus = await this.redis.get(`provider:${providerId}:circuit_breaker`);
      if (circuitBreakerStatus === 'OPEN') {
        return false;
      }

      // Check rate limits
      const rateLimitCount = await this.redis.get(`provider:${providerId}:rate_limit_count`);
      const rateLimitMax = await this.redis.get(`provider:${providerId}:rate_limit_max`);
      
      if (rateLimitCount && rateLimitMax) {
        const count = parseInt(rateLimitCount);
        const max = parseInt(rateLimitMax);
        if (count >= max) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Error checking provider availability: ${error.message}`);
      return true; // Default to available on error
    }
  }

  /**
   * Check if provider supports a specific model
   */
  private supportsModel(provider: Provider, model: string): boolean {
    // This would be enhanced with actual model support data
    const modelSupport: Record<ProviderType, string[]> = {
      OPENAI: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
      ANTHROPIC: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      GOOGLE: ['gemini-pro', 'gemini-pro-vision', 'gemini-ultra'],
      MISTRAL: ['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large'],
      GROQ: ['mixtral-8x7b-32768', 'llama2-70b-4096'],
      DEEPSEEK: ['deepseek-chat', 'deepseek-coder'],
      HUGGINGFACE: [], // Dynamic based on endpoint
      OPENROUTER: [], // Dynamic based on endpoint
      OLLAMA: [], // Dynamic based on local models
      LOCALAI: [], // Dynamic based on local models
      CUSTOM: [] // Dynamic based on configuration
    };

    const supportedModels = modelSupport[provider.type] || [];
    return supportedModels.length === 0 || supportedModels.includes(model);
  }

  /**
   * Estimate cost for a request
   */
  private estimateCost(provider: Provider, request: ExecuteProviderDto): number {
    if (!provider.costPerToken) return 0;

    // Rough estimation based on message length
    const totalChars = request.messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 4); // Rough token estimation
    const maxTokens = request.maxTokens || 1000;
    
    return provider.costPerToken * (estimatedTokens + maxTokens);
  }

  /**
   * Generate reasoning for provider selection
   */
  private generateReasoning(
    provider: Provider,
    metrics: ProviderMetrics,
    preferences?: SmartRoutingPreferencesDto
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Selected ${provider.name} (${provider.type})`);

    if (preferences?.strategy === 'cost') {
      reasoning.push(`Optimized for cost: $${metrics.costPerToken.toFixed(6)} per token`);
    } else if (preferences?.strategy === 'latency') {
      reasoning.push(`Optimized for speed: ${metrics.avgLatency}ms average response time`);
    } else if (preferences?.strategy === 'quality') {
      reasoning.push(`Optimized for quality: ${(metrics.successRate * 100).toFixed(1)}% success rate`);
    } else {
      reasoning.push(`Balanced selection based on multiple factors`);
    }

    if (metrics.healthScore > 90) {
      reasoning.push(`Excellent health score: ${metrics.healthScore.toFixed(0)}/100`);
    } else if (metrics.healthScore > 70) {
      reasoning.push(`Good health score: ${metrics.healthScore.toFixed(0)}/100`);
    }

    if (metrics.currentLoad < 0.3) {
      reasoning.push(`Low current load: ${(metrics.currentLoad * 100).toFixed(0)}%`);
    }

    if (provider.priority && provider.priority > 70) {
      reasoning.push(`High priority provider (${provider.priority}/100)`);
    }

    return reasoning;
  }

  /**
   * Generate cache key for routing decisions
   */
  private generateCacheKey(
    organizationId: string,
    request: ExecuteProviderDto,
    preferences?: SmartRoutingPreferencesDto
  ): string {
    const key = {
      org: organizationId,
      model: request.model,
      strategy: preferences?.strategy || 'balanced',
      capabilities: preferences?.requireCapabilities?.sort().join(',') || '',
      maxCost: preferences?.maxCost || 0,
      maxLatency: preferences?.maxLatency || 0
    };

    return `routing:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  /**
   * Check if cached routing decision is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    // For now, we rely on the setTimeout in selectOptimalProvider
    // In a production system, you might want more sophisticated cache invalidation
    return this.routingCache.has(cacheKey);
  }

  /**
   * Start background metrics updater
   */
  private startMetricsUpdater(): void {
    // Update metrics every 30 seconds
    setInterval(async () => {
      try {
        await this.updateAllProviderMetrics();
      } catch (error) {
        this.logger.error(`Error updating provider metrics: ${error.message}`);
      }
    }, 30000);
  }

  /**
   * Update metrics for all active providers
   */
  private async updateAllProviderMetrics(): Promise<void> {
    try {
      const providers = await this.prisma.provider.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      // Update metrics in parallel, but limit concurrency
      const batchSize = 10;
      for (let i = 0; i < providers.length; i += batchSize) {
        const batch = providers.slice(i, i + batchSize);
        await Promise.all(
          batch.map(provider => this.getProviderMetrics(provider.id))
        );
      }
    } catch (error) {
      this.logger.error(`Error in metrics updater: ${error.message}`);
    }
  }

  /**
   * Get routing statistics for analytics
   */
  async getRoutingStatistics(organizationId: string, days: number = 7): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const metrics = await this.prisma.providerUsageMetric.findMany({
        where: {
          provider: { organizationId },
          date: { gte: startDate }
        },
        include: { provider: true }
      });

      const stats = {
        totalRequests: 0,
        totalCost: 0,
        avgLatency: 0,
        providerDistribution: {} as Record<string, number>,
        strategyEffectiveness: {} as Record<string, any>,
        costSavings: 0,
        latencyImprovement: 0
      };

      for (const metric of metrics) {
        stats.totalRequests += metric.requests;
        stats.totalCost += metric.cost;
        
        const providerName = metric.provider.name;
        stats.providerDistribution[providerName] = 
          (stats.providerDistribution[providerName] || 0) + metric.requests;
      }

      stats.avgLatency = metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length : 0;

      return stats;
    } catch (error) {
      this.logger.error(`Error getting routing statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear routing cache (useful for testing or manual cache invalidation)
   */
  clearCache(): void {
    this.routingCache.clear();
    this.metricsCache.clear();
  }
}