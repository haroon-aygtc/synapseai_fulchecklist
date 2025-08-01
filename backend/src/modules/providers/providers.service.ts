import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { 
  ProviderType, 
  ProviderHealthStatus, 
  CircuitBreakerStatus,
  Provider,
  ProviderUsageMetric,
  ProviderHealthCheck,
  ProviderRoutingRule,
  ProviderFallbackChain
} from '@prisma/client';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ExecuteProviderDto,
  SmartRoutingPreferencesDto,
  TestProviderDto,
  CreateRoutingRuleDto,
  UpdateRoutingRuleDto,
  CreateFallbackChainDto,
  ProviderAnalyticsQueryDto,
  ProviderHealthCheckDto,
  ProviderConfigValidationDto,
  ProviderResponseDto,
  ProviderExecutionResultDto,
  ProviderAnalyticsDto
} from './dto/provider.dto';
import * as crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

interface ProviderClient {
  execute(data: ExecuteProviderDto): Promise<any>;
  test(data: TestProviderDto): Promise<any>;
  getModels(): Promise<string[]>;
  getCapabilities(): Promise<string[]>;
}

interface CircuitBreakerState {
  status: CircuitBreakerStatus;
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

interface RateLimitState {
  count: number;
  resetTime: Date;
}

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private readonly encryptionKey: string;
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly rateLimits = new Map<string, RateLimitState>();
  private readonly providerClients = new Map<string, ProviderClient>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly apix: ApixService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = this.config.get<string>('ENCRYPTION_KEY') || crypto.randomBytes(32).toString('hex');
    this.initializeProviderClients();
    this.startHealthCheckScheduler();
    this.startMetricsAggregator();
  }

  // CRUD Operations
  async createProvider(userId: string, organizationId: string, dto: CreateProviderDto): Promise<ProviderResponseDto> {
    try {
      // Validate provider configuration
      await this.validateProviderConfig({
        type: dto.type,
        endpoint: dto.endpoint,
        apiKey: dto.apiKey,
        config: dto.config
      });

      // Encrypt API key
      const encryptedApiKey = this.encryptCredentials(dto.apiKey);
      const encryptedCredentials = this.encryptCredentials(JSON.stringify({
        apiKey: dto.apiKey,
        ...dto.config
      }));

      // Create provider
      const provider = await this.prisma.provider.create({
        data: {
          name: dto.name,
          type: dto.type,
          endpoint: dto.endpoint,
          apiKey: encryptedApiKey,
          config: dto.config || {},
          capabilities: dto.capabilities || this.getDefaultCapabilities(dto.type),
          priority: dto.priority || 50,
          rateLimit: dto.rateLimit,
          costPerToken: dto.costPerToken,
          metadata: dto.metadata || {},
          userId,
          organizationId,
          encryptedCredentials,
          healthStatus: ProviderHealthStatus.UNKNOWN,
          circuitBreakerStatus: CircuitBreakerStatus.CLOSED,
        },
        include: {
          routingRules: true,
          usageMetrics: {
            take: 30,
            orderBy: { date: 'desc' }
          },
          healthChecks: {
            take: 10,
            orderBy: { checkedAt: 'desc' }
          }
        }
      });

      // Initialize circuit breaker
      this.circuitBreakers.set(provider.id, {
        status: CircuitBreakerStatus.CLOSED,
        failureCount: 0
      });

      // Initialize provider client
      await this.initializeProviderClient(provider);

      // Perform initial health check
      setTimeout(() => this.performHealthCheck(provider.id, organizationId), 1000);

      // Emit creation event
      await this.emitProviderEvent('PROVIDER_CREATED', provider.id, organizationId, {
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.type
      });

      return this.mapToProviderResponse(provider);
    } catch (error) {
      this.logger.error(`Error creating provider: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create provider');
    }
  }

  async getProviders(organizationId: string, filters: any = {}, options: any = {}): Promise<{
    providers: ProviderResponseDto[];
    total: number;
    pagination: any;
  }> {
    try {
      const where = {
        organizationId,
        ...filters
      };

      const [providers, total] = await Promise.all([
        this.prisma.provider.findMany({
          where,
          include: {
            routingRules: options.includeMetrics,
            usageMetrics: options.includeMetrics ? {
              take: 30,
              orderBy: { date: 'desc' }
            } : false,
            healthChecks: options.includeMetrics ? {
              take: 10,
              orderBy: { checkedAt: 'desc' }
            } : false
          },
          orderBy: { [options.sortBy]: options.sortOrder },
          take: options.limit,
          skip: options.offset
        }),
        this.prisma.provider.count({ where })
      ]);

      return {
        providers: providers.map(p => this.mapToProviderResponse(p)),
        total,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          hasMore: options.offset + providers.length < total
        }
      };
    } catch (error) {
      this.logger.error(`Error getting providers: ${error.message}`);
      throw new InternalServerErrorException('Failed to get providers');
    }
  }

  async getProvider(id: string, organizationId: string, options: any = {}): Promise<ProviderResponseDto> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId },
        include: {
          routingRules: true,
          usageMetrics: options.includeMetrics ? {
            take: 30,
            orderBy: { date: 'desc' }
          } : false,
          healthChecks: options.includeMetrics ? {
            take: 10,
            orderBy: { checkedAt: 'desc' }
          } : false
        }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      return this.mapToProviderResponse(provider);
    } catch (error) {
      this.logger.error(`Error getting provider: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get provider');
    }
  }

  async updateProvider(id: string, organizationId: string, dto: UpdateProviderDto): Promise<ProviderResponseDto> {
    try {
      const existingProvider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!existingProvider) {
        throw new NotFoundException('Provider not found');
      }

      const updateData: any = { ...dto };

      // Handle API key encryption if provided
      if (dto.apiKey) {
        updateData.apiKey = this.encryptCredentials(dto.apiKey);
        
        // Update encrypted credentials
        const existingCredentials = existingProvider.encryptedCredentials ? 
          JSON.parse(this.decryptCredentials(existingProvider.encryptedCredentials as string)) : {};
        
        updateData.encryptedCredentials = this.encryptCredentials(JSON.stringify({
          ...existingCredentials,
          apiKey: dto.apiKey,
          ...dto.config
        }));
      }

      const provider = await this.prisma.provider.update({
        where: { id },
        data: updateData,
        include: {
          routingRules: true,
          usageMetrics: {
            take: 30,
            orderBy: { date: 'desc' }
          },
          healthChecks: {
            take: 10,
            orderBy: { checkedAt: 'desc' }
          }
        }
      });

      // Reinitialize provider client if credentials changed
      if (dto.apiKey || dto.config || dto.endpoint) {
        await this.initializeProviderClient(provider);
      }

      // Emit update event
      await this.emitProviderEvent('PROVIDER_UPDATED', provider.id, organizationId, {
        providerId: provider.id,
        changes: Object.keys(dto)
      });

      return this.mapToProviderResponse(provider);
    } catch (error) {
      this.logger.error(`Error updating provider: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update provider');
    }
  }

  async deleteProvider(id: string, organizationId: string): Promise<void> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      // Remove from circuit breakers and rate limits
      this.circuitBreakers.delete(id);
      this.rateLimits.delete(id);
      this.providerClients.delete(id);

      // Delete provider and related data
      await this.prisma.provider.delete({
        where: { id }
      });

      // Emit deletion event
      await this.emitProviderEvent('PROVIDER_DELETED', id, organizationId, {
        providerId: id,
        providerName: provider.name
      });
    } catch (error) {
      this.logger.error(`Error deleting provider: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete provider');
    }
  }

  // Smart Routing and Execution
  async executeWithSmartRouting(
    organizationId: string,
    data: ExecuteProviderDto,
    preferences?: SmartRoutingPreferencesDto
  ): Promise<ProviderExecutionResultDto> {
    const startTime = Date.now();
    let attempts = 0;
    const maxRetries = preferences?.maxRetries || 3;
    let lastError: Error;

    try {
      while (attempts < maxRetries) {
        attempts++;
        
        // Select best provider based on routing strategy
        const selectedProvider = await this.selectOptimalProvider(organizationId, data, preferences);
        
        if (!selectedProvider) {
          throw new BadRequestException('No suitable provider available');
        }

        try {
          // Check circuit breaker
          if (!this.isCircuitBreakerClosed(selectedProvider.id)) {
            throw new Error('Circuit breaker is open');
          }

          // Check rate limits
          if (!await this.checkRateLimit(selectedProvider.id)) {
            throw new Error('Rate limit exceeded');
          }

          // Execute with selected provider
          const result = await this.executeWithProvider(selectedProvider.id, data);
          
          // Record successful execution
          await this.recordExecution(selectedProvider.id, organizationId, {
            success: true,
            duration: Date.now() - startTime,
            tokensUsed: result.usage?.totalTokens || 0,
            cost: this.calculateCost(selectedProvider, result.usage?.totalTokens || 0)
          });

          // Reset circuit breaker on success
          this.resetCircuitBreakerFailures(selectedProvider.id);

          return {
            ...result,
            provider: {
              id: selectedProvider.id,
              name: selectedProvider.name,
              type: selectedProvider.type
            },
            metadata: {
              duration: Date.now() - startTime,
              tokensUsed: result.usage?.totalTokens || 0,
              cost: this.calculateCost(selectedProvider, result.usage?.totalTokens || 0),
              attempts,
              strategy: preferences?.strategy || 'balanced',
              fallbackUsed: attempts > 1
            }
          };
        } catch (error) {
          lastError = error;
          
          // Record failed execution
          await this.recordExecution(selectedProvider.id, organizationId, {
            success: false,
            duration: Date.now() - startTime,
            error: error.message
          });

          // Update circuit breaker
          this.recordCircuitBreakerFailure(selectedProvider.id);

          // Try fallback if available and enabled
          if (preferences?.enableFallback !== false && attempts < maxRetries) {
            const fallbackProvider = await this.getFallbackProvider(selectedProvider.id, organizationId);
            if (fallbackProvider) {
              continue;
            }
          }

          // If this was the last attempt, throw the error
          if (attempts >= maxRetries) {
            throw error;
          }
        }
      }

      throw lastError || new InternalServerErrorException('All provider attempts failed');
    } catch (error) {
      this.logger.error(`Smart routing execution failed: ${error.message}`);
      
      // Emit failure event
      await this.emitProviderEvent('EXECUTION_FAILED', null, organizationId, {
        error: error.message,
        attempts,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  async executeWithProvider(id: string, data: ExecuteProviderDto): Promise<any> {
    try {
      const client = this.providerClients.get(id);
      if (!client) {
        throw new BadRequestException('Provider client not initialized');
      }

      const result = await client.execute(data);
      return result;
    } catch (error) {
      this.logger.error(`Provider execution failed: ${error.message}`);
      throw error;
    }
  }

  async executeWithProviderStream(id: string, data: ExecuteProviderDto): Promise<any> {
    try {
      const client = this.providerClients.get(id);
      if (!client) {
        throw new BadRequestException('Provider client not initialized');
      }

      // For streaming, we need to handle the response differently
      const streamData = { ...data, stream: true };
      return await client.execute(streamData);
    } catch (error) {
      this.logger.error(`Provider streaming execution failed: ${error.message}`);
      throw error;
    }
  }

  // Testing and Validation
  async testProvider(id: string, organizationId: string, dto: TestProviderDto): Promise<any> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const client = this.providerClients.get(id);
      if (!client) {
        throw new BadRequestException('Provider client not initialized');
      }

      const startTime = Date.now();
      const result = await client.test(dto);
      const duration = Date.now() - startTime;

      // Update health status
      await this.updateProviderHealth(id, ProviderHealthStatus.HEALTHY, duration);

      // Emit test event
      await this.emitProviderEvent('PROVIDER_TESTED', id, organizationId, {
        providerId: id,
        success: true,
        duration
      });

      return {
        success: true,
        duration,
        result,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Provider test failed: ${error.message}`);
      
      // Update health status
      await this.updateProviderHealth(id, ProviderHealthStatus.UNHEALTHY, null, error.message);

      // Emit test failure event
      await this.emitProviderEvent('PROVIDER_TEST_FAILED', id, organizationId, {
        providerId: id,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  async testProviderConfig(dto: ProviderConfigValidationDto): Promise<any> {
    try {
      // Create temporary client for testing
      const tempClient = this.createProviderClient(dto.type, {
        endpoint: dto.endpoint,
        apiKey: dto.apiKey,
        config: dto.config || {}
      });

      const startTime = Date.now();
      const result = await tempClient.test({
        message: 'Test connection',
        maxTokens: 10
      });
      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
        capabilities: await tempClient.getCapabilities(),
        models: await tempClient.getModels(),
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Provider config test failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  async bulkTestProviders(organizationId: string, providerIds: string[]): Promise<any[]> {
    const results = await Promise.allSettled(
      providerIds.map(id => this.testProvider(id, organizationId, { message: 'Bulk test' }))
    );

    return results.map((result, index) => ({
      providerId: providerIds[index],
      ...(result.status === 'fulfilled' ? result.value : { success: false, error: result.reason?.message })
    }));
  }

  // Health Checks
  async checkProviderHealth(id: string, organizationId: string, dto: ProviderHealthCheckDto): Promise<any> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      return await this.performHealthCheck(id, organizationId, dto.timeout);
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Health check failed');
    }
  }

  async getProviderHealthHistory(id: string, organizationId: string, options: any): Promise<ProviderHealthCheck[]> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const where: any = { providerId: id };
      if (options.startDate) where.checkedAt = { gte: options.startDate };
      if (options.endDate) where.checkedAt = { ...where.checkedAt, lte: options.endDate };

      return await this.prisma.providerHealthCheck.findMany({
        where,
        orderBy: { checkedAt: 'desc' },
        take: options.limit
      });
    } catch (error) {
      this.logger.error(`Error getting health history: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get health history');
    }
  }

  // Analytics
  async getProviderAnalytics(id: string, organizationId: string, query: ProviderAnalyticsQueryDto): Promise<ProviderAnalyticsDto> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId },
        include: {
          usageMetrics: {
            where: {
              date: {
                gte: query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: query.endDate || new Date()
              }
            },
            orderBy: { date: 'asc' }
          }
        }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const metrics = provider.usageMetrics;
      const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
      const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
      const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
      const avgLatency = metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length : 0;

      return {
        provider: this.mapToProviderResponse(provider),
        totalRequests,
        totalErrors,
        errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
        totalCost,
        avgLatency,
        successRate: totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 0,
        dailyMetrics: metrics.map(m => ({
          date: m.date,
          requests: m.requests,
          errors: m.errors,
          cost: m.cost,
          avgLatency: m.avgLatency
        })),
        performanceScore: this.calculatePerformanceScore(provider, metrics),
        healthScore: this.calculateHealthScore(provider),
        costEfficiencyScore: this.calculateCostEfficiencyScore(provider, metrics)
      };
    } catch (error) {
      this.logger.error(`Error getting provider analytics: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get provider analytics');
    }
  }

  async getProvidersOverview(organizationId: string, query: ProviderAnalyticsQueryDto): Promise<any> {
    try {
      const providers = await this.prisma.provider.findMany({
        where: { organizationId },
        include: {
          usageMetrics: {
            where: {
              date: {
                gte: query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: query.endDate || new Date()
              }
            }
          }
        }
      });

      const overview = {
        totalProviders: providers.length,
        activeProviders: providers.filter(p => p.isActive).length,
        healthyProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.HEALTHY).length,
        totalRequests: 0,
        totalCost: 0,
        avgResponseTime: 0,
        providerBreakdown: [] as any[]
      };

      for (const provider of providers) {
        const metrics = provider.usageMetrics;
        const requests = metrics.reduce((sum, m) => sum + m.requests, 0);
        const cost = metrics.reduce((sum, m) => sum + m.cost, 0);
        
        overview.totalRequests += requests;
        overview.totalCost += cost;
        
        overview.providerBreakdown.push({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          requests,
          cost,
          healthStatus: provider.healthStatus,
          avgResponseTime: provider.avgResponseTime
        });
      }

      overview.avgResponseTime = providers.length > 0 ? 
        providers.reduce((sum, p) => sum + (p.avgResponseTime || 0), 0) / providers.length : 0;

      return overview;
    } catch (error) {
      this.logger.error(`Error getting providers overview: ${error.message}`);
      throw new InternalServerErrorException('Failed to get providers overview');
    }
  }

  async getProvidersCostAnalytics(organizationId: string, query: ProviderAnalyticsQueryDto): Promise<any> {
    try {
      const providers = await this.prisma.provider.findMany({
        where: { organizationId },
        include: {
          usageMetrics: {
            where: {
              date: {
                gte: query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: query.endDate || new Date()
              }
            },
            orderBy: { date: 'asc' }
          }
        }
      });

      const costAnalytics = {
        totalCost: 0,
        costByProvider: [] as any[],
        costTrend: [] as any[],
        costByType: {} as Record<string, number>
      };

      // Aggregate costs by provider
      for (const provider of providers) {
        const providerCost = provider.usageMetrics.reduce((sum, m) => sum + m.cost, 0);
        costAnalytics.totalCost += providerCost;
        
        costAnalytics.costByProvider.push({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          cost: providerCost,
          percentage: 0 // Will be calculated after total is known
        });

        // Aggregate by type
        costAnalytics.costByType[provider.type] = 
          (costAnalytics.costByType[provider.type] || 0) + providerCost;
      }

      // Calculate percentages
      costAnalytics.costByProvider.forEach(item => {
        item.percentage = costAnalytics.totalCost > 0 ? 
          (item.cost / costAnalytics.totalCost) * 100 : 0;
      });

      // Generate cost trend (daily aggregation)
      const dateMap = new Map<string, number>();
      for (const provider of providers) {
        for (const metric of provider.usageMetrics) {
          const dateKey = metric.date.toISOString().split('T')[0];
          dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + metric.cost);
        }
      }

      costAnalytics.costTrend = Array.from(dateMap.entries())
        .map(([date, cost]) => ({ date: new Date(date), cost }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      return costAnalytics;
    } catch (error) {
      this.logger.error(`Error getting cost analytics: ${error.message}`);
      throw new InternalServerErrorException('Failed to get cost analytics');
    }
  }

  async getProvidersPerformanceAnalytics(organizationId: string, query: ProviderAnalyticsQueryDto): Promise<any> {
    try {
      const providers = await this.prisma.provider.findMany({
        where: { organizationId },
        include: {
          usageMetrics: {
            where: {
              date: {
                gte: query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: query.endDate || new Date()
              }
            }
          },
          healthChecks: {
            where: {
              checkedAt: {
                gte: query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: query.endDate || new Date()
              }
            }
          }
        }
      });

      const performanceAnalytics = {
        avgResponseTime: 0,
        successRate: 0,
        performanceByProvider: [] as any[],
        performanceTrend: [] as any[]
      };

      let totalRequests = 0;
      let totalErrors = 0;
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      for (const provider of providers) {
        const requests = provider.usageMetrics.reduce((sum, m) => sum + m.requests, 0);
        const errors = provider.usageMetrics.reduce((sum, m) => sum + m.errors, 0);
        const avgLatency = provider.usageMetrics.length > 0 ? 
          provider.usageMetrics.reduce((sum, m) => sum + m.avgLatency, 0) / provider.usageMetrics.length : 0;

        totalRequests += requests;
        totalErrors += errors;
        
        if (avgLatency > 0) {
          totalResponseTime += avgLatency;
          responseTimeCount++;
        }

        performanceAnalytics.performanceByProvider.push({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          avgResponseTime: avgLatency,
          successRate: requests > 0 ? ((requests - errors) / requests) * 100 : 0,
          totalRequests: requests,
          healthStatus: provider.healthStatus
        });
      }

      performanceAnalytics.avgResponseTime = responseTimeCount > 0 ? 
        totalResponseTime / responseTimeCount : 0;
      performanceAnalytics.successRate = totalRequests > 0 ? 
        ((totalRequests - totalErrors) / totalRequests) * 100 : 0;

      return performanceAnalytics;
    } catch (error) {
      this.logger.error(`Error getting performance analytics: ${error.message}`);
      throw new InternalServerErrorException('Failed to get performance analytics');
    }
  }

  // Routing Rules Management
  async createRoutingRule(providerId: string, organizationId: string, dto: CreateRoutingRuleDto): Promise<ProviderRoutingRule> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id: providerId, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      return await this.prisma.providerRoutingRule.create({
        data: {
          providerId,
          condition: dto.condition,
          priority: dto.priority || 0,
          fallback: dto.fallback || false,
          metadata: dto.metadata || {}
        }
      });
    } catch (error) {
      this.logger.error(`Error creating routing rule: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create routing rule');
    }
  }

  async getRoutingRules(providerId: string, organizationId: string): Promise<ProviderRoutingRule[]> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id: providerId, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      return await this.prisma.providerRoutingRule.findMany({
        where: { providerId },
        orderBy: { priority: 'desc' }
      });
    } catch (error) {
      this.logger.error(`Error getting routing rules: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get routing rules');
    }
  }

  async updateRoutingRule(ruleId: string, organizationId: string, dto: UpdateRoutingRuleDto): Promise<ProviderRoutingRule> {
    try {
      const rule = await this.prisma.providerRoutingRule.findFirst({
        where: { 
          id: ruleId,
          provider: { organizationId }
        }
      });

      if (!rule) {
        throw new NotFoundException('Routing rule not found');
      }

      return await this.prisma.providerRoutingRule.update({
        where: { id: ruleId },
        data: dto
      });
    } catch (error) {
      this.logger.error(`Error updating routing rule: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update routing rule');
    }
  }

  async deleteRoutingRule(ruleId: string, organizationId: string): Promise<void> {
    try {
      const rule = await this.prisma.providerRoutingRule.findFirst({
        where: { 
          id: ruleId,
          provider: { organizationId }
        }
      });

      if (!rule) {
        throw new NotFoundException('Routing rule not found');
      }

      await this.prisma.providerRoutingRule.delete({
        where: { id: ruleId }
      });
    } catch (error) {
      this.logger.error(`Error deleting routing rule: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete routing rule');
    }
  }

  // Fallback Chain Management
  async createFallbackChain(organizationId: string, dto: CreateFallbackChainDto): Promise<ProviderFallbackChain> {
    try {
      const [primaryProvider, fallbackProvider] = await Promise.all([
        this.prisma.provider.findFirst({
          where: { id: dto.primaryProviderId, organizationId }
        }),
        this.prisma.provider.findFirst({
          where: { id: dto.fallbackProviderId, organizationId }
        })
      ]);

      if (!primaryProvider || !fallbackProvider) {
        throw new NotFoundException('One or both providers not found');
      }

      return await this.prisma.providerFallbackChain.create({
        data: {
          primaryProviderId: dto.primaryProviderId,
          fallbackProviderId: dto.fallbackProviderId,
          priority: dto.priority || 0,
          condition: dto.condition || {}
        }
      });
    } catch (error) {
      this.logger.error(`Error creating fallback chain: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create fallback chain');
    }
  }

  async getFallbackChains(organizationId: string): Promise<ProviderFallbackChain[]> {
    try {
      return await this.prisma.providerFallbackChain.findMany({
        where: {
          primaryProvider: { organizationId }
        },
        include: {
          primaryProvider: true
        },
        orderBy: { priority: 'desc' }
      });
    } catch (error) {
      this.logger.error(`Error getting fallback chains: ${error.message}`);
      throw new InternalServerErrorException('Failed to get fallback chains');
    }
  }

  async deleteFallbackChain(chainId: string, organizationId: string): Promise<void> {
    try {
      const chain = await this.prisma.providerFallbackChain.findFirst({
        where: { 
          id: chainId,
          primaryProvider: { organizationId }
        }
      });

      if (!chain) {
        throw new NotFoundException('Fallback chain not found');
      }

      await this.prisma.providerFallbackChain.delete({
        where: { id: chainId }
      });
    } catch (error) {
      this.logger.error(`Error deleting fallback chain: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete fallback chain');
    }
  }

  // Bulk Operations
  async bulkOperation(organizationId: string, operation: string, providerIds: string[], parameters?: any): Promise<any[]> {
    const results = [];

    for (const providerId of providerIds) {
      try {
        let result;
        switch (operation) {
          case 'activate':
            result = await this.updateProvider(providerId, organizationId, { isActive: true });
            break;
          case 'deactivate':
            result = await this.updateProvider(providerId, organizationId, { isActive: false });
            break;
          case 'delete':
            await this.deleteProvider(providerId, organizationId);
            result = { success: true };
            break;
          case 'health_check':
            result = await this.performHealthCheck(providerId, organizationId);
            break;
          default:
            throw new BadRequestException(`Unknown operation: ${operation}`);
        }
        
        results.push({ providerId, success: true, result });
      } catch (error) {
        results.push({ providerId, success: false, error: error.message });
      }
    }

    return results;
  }

  // Models and Capabilities
  async getProviderModels(id: string, organizationId: string): Promise<string[]> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const client = this.providerClients.get(id);
      if (!client) {
        throw new BadRequestException('Provider client not initialized');
      }

      return await client.getModels();
    } catch (error) {
      this.logger.error(`Error getting provider models: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get provider models');
    }
  }

  async getProviderCapabilities(id: string, organizationId: string): Promise<string[]> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const client = this.providerClients.get(id);
      if (!client) {
        return provider.capabilities;
      }

      return await client.getCapabilities();
    } catch (error) {
      this.logger.error(`Error getting provider capabilities: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get provider capabilities');
    }
  }

  // Circuit Breaker Management
  async resetCircuitBreaker(id: string, organizationId: string): Promise<any> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      this.circuitBreakers.set(id, {
        status: CircuitBreakerStatus.CLOSED,
        failureCount: 0
      });

      await this.prisma.provider.update({
        where: { id },
        data: { circuitBreakerStatus: CircuitBreakerStatus.CLOSED }
      });

      return { success: true, status: 'CLOSED' };
    } catch (error) {
      this.logger.error(`Error resetting circuit breaker: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to reset circuit breaker');
    }
  }

  async getCircuitBreakerStatus(id: string, organizationId: string): Promise<any> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const circuitBreaker = this.circuitBreakers.get(id) || {
        status: CircuitBreakerStatus.CLOSED,
        failureCount: 0
      };

      return {
        status: circuitBreaker.status,
        failureCount: circuitBreaker.failureCount,
        lastFailureTime: circuitBreaker.lastFailureTime,
        nextRetryTime: circuitBreaker.nextRetryTime
      };
    } catch (error) {
      this.logger.error(`Error getting circuit breaker status: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get circuit breaker status');
    }
  }

  // Rate Limiting
  async getRateLimitStatus(id: string, organizationId: string): Promise<any> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const rateLimit = this.rateLimits.get(id);
      const limit = provider.rateLimit || 1000;

      return {
        limit,
        remaining: rateLimit ? Math.max(0, limit - rateLimit.count) : limit,
        resetTime: rateLimit?.resetTime || new Date(Date.now() + 60000),
        current: rateLimit?.count || 0
      };
    } catch (error) {
      this.logger.error(`Error getting rate limit status: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get rate limit status');
    }
  }

  async resetRateLimit(id: string, organizationId: string): Promise<any> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      this.rateLimits.delete(id);

      return { success: true, message: 'Rate limit reset' };
    } catch (error) {
      this.logger.error(`Error resetting rate limit: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to reset rate limit');
    }
  }

  // System Status
  async getSystemStatus(organizationId: string): Promise<any> {
    try {
      const providers = await this.prisma.provider.findMany({
        where: { organizationId }
      });

      const status = {
        totalProviders: providers.length,
        activeProviders: providers.filter(p => p.isActive).length,
        healthyProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.HEALTHY).length,
        degradedProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.DEGRADED).length,
        unhealthyProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.UNHEALTHY).length,
        circuitBreakersOpen: providers.filter(p => p.circuitBreakerStatus === CircuitBreakerStatus.OPEN).length,
        overallHealth: 'HEALTHY' as string
      };

      // Determine overall health
      if (status.unhealthyProviders > status.totalProviders * 0.5) {
        status.overallHealth = 'UNHEALTHY';
      } else if (status.degradedProviders > status.totalProviders * 0.3) {
        status.overallHealth = 'DEGRADED';
      }

      return status;
    } catch (error) {
      this.logger.error(`Error getting system status: ${error.message}`);
      throw new InternalServerErrorException('Failed to get system status');
    }
  }

  async getSystemMetrics(organizationId: string): Promise<any> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const metrics = await this.prisma.providerUsageMetric.findMany({
        where: {
          provider: { organizationId },
          date: { gte: oneHourAgo }
        },
        include: { provider: true }
      });

      const systemMetrics = {
        totalRequests: metrics.reduce((sum, m) => sum + m.requests, 0),
        totalErrors: metrics.reduce((sum, m) => sum + m.errors, 0),
        totalCost: metrics.reduce((sum, m) => sum + m.cost, 0),
        avgLatency: metrics.length > 0 ? 
          metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length : 0,
        requestsPerMinute: metrics.reduce((sum, m) => sum + m.requests, 0) / 60,
        errorRate: 0,
        costPerRequest: 0,
        providerDistribution: {} as Record<string, number>
      };

      systemMetrics.errorRate = systemMetrics.totalRequests > 0 ? 
        systemMetrics.totalErrors / systemMetrics.totalRequests : 0;
      systemMetrics.costPerRequest = systemMetrics.totalRequests > 0 ? 
        systemMetrics.totalCost / systemMetrics.totalRequests : 0;

      // Provider distribution
      for (const metric of metrics) {
        const providerType = metric.provider.type;
        systemMetrics.providerDistribution[providerType] = 
          (systemMetrics.providerDistribution[providerType] || 0) + metric.requests;
      }

      return systemMetrics;
    } catch (error) {
      this.logger.error(`Error getting system metrics: ${error.message}`);
      throw new InternalServerErrorException('Failed to get system metrics');
    }
  }

  // Private Helper Methods
  private async validateProviderConfig(config: ProviderConfigValidationDto): Promise<void> {
    if (!config.apiKey) {
      throw new BadRequestException('API key is required');
    }

    // Validate provider-specific requirements
    switch (config.type) {
      case ProviderType.OPENAI:
        if (!config.apiKey.startsWith('sk-')) {
          throw new BadRequestException('Invalid OpenAI API key format');
        }
        break;
      case ProviderType.ANTHROPIC:
        if (!config.apiKey.startsWith('sk-ant-')) {
          throw new BadRequestException('Invalid Anthropic API key format');
        }
        break;
      case ProviderType.CUSTOM:
        if (!config.endpoint) {
          throw new BadRequestException('Endpoint is required for custom providers');
        }
        break;
    }
  }

  private encryptCredentials(data: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptCredentials(encryptedData: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getDefaultCapabilities(type: ProviderType): string[] {
    const capabilityMap = {
      [ProviderType.OPENAI]: ['chat', 'completion', 'embedding', 'function_calling', 'vision'],
      [ProviderType.ANTHROPIC]: ['chat', 'completion', 'function_calling'],
      [ProviderType.GOOGLE]: ['chat', 'completion', 'embedding', 'vision'],
      [ProviderType.MISTRAL]: ['chat', 'completion', 'function_calling'],
      [ProviderType.GROQ]: ['chat', 'completion'],
      [ProviderType.DEEPSEEK]: ['chat', 'completion', 'function_calling'],
      [ProviderType.HUGGINGFACE]: ['chat', 'completion', 'embedding'],
      [ProviderType.OPENROUTER]: ['chat', 'completion', 'function_calling'],
      [ProviderType.OLLAMA]: ['chat', 'completion', 'embedding'],
      [ProviderType.LOCALAI]: ['chat', 'completion', 'embedding'],
      [ProviderType.CUSTOM]: ['chat', 'completion']
    };

    return capabilityMap[type] || ['chat', 'completion'];
  }

  private async initializeProviderClients(): Promise<void> {
    // Initialize clients for existing providers
    const providers = await this.prisma.provider.findMany({
      where: { isActive: true }
    });

    for (const provider of providers) {
      await this.initializeProviderClient(provider);
    }
  }

  private async initializeProviderClient(provider: Provider): Promise<void> {
    try {
      const credentials = provider.encryptedCredentials ? 
        JSON.parse(this.decryptCredentials(provider.encryptedCredentials as string)) : 
        { apiKey: this.decryptCredentials(provider.apiKey) };

      const client = this.createProviderClient(provider.type, {
        endpoint: provider.endpoint,
        ...credentials,
        config: provider.config
      });

      this.providerClients.set(provider.id, client);
    } catch (error) {
      this.logger.error(`Failed to initialize client for provider ${provider.id}: ${error.message}`);
    }
  }

  private createProviderClient(type: ProviderType, config: any): ProviderClient {
    switch (type) {
      case ProviderType.OPENAI:
        return new OpenAIProviderClient(config);
      case ProviderType.ANTHROPIC:
        return new AnthropicProviderClient(config);
      case ProviderType.GOOGLE:
        return new GoogleProviderClient(config);
      case ProviderType.MISTRAL:
        return new MistralProviderClient(config);
      case ProviderType.GROQ:
        return new GroqProviderClient(config);
      case ProviderType.DEEPSEEK:
        return new DeepSeekProviderClient(config);
      case ProviderType.HUGGINGFACE:
        return new HuggingFaceProviderClient(config);
      case ProviderType.OPENROUTER:
        return new OpenRouterProviderClient(config);
      case ProviderType.OLLAMA:
        return new OllamaProviderClient(config);
      case ProviderType.LOCALAI:
        return new LocalAIProviderClient(config);
      case ProviderType.CUSTOM:
        return new CustomProviderClient(config);
      default:
        throw new BadRequestException(`Unsupported provider type: ${type}`);
    }
  }

  private async selectOptimalProvider(
    organizationId: string,
    data: ExecuteProviderDto,
    preferences?: SmartRoutingPreferencesDto
  ): Promise<Provider | null> {
    const providers = await this.prisma.provider.findMany({
      where: {
        organizationId,
        isActive: true,
        healthStatus: { not: ProviderHealthStatus.UNHEALTHY }
      },
      orderBy: { priority: 'desc' }
    });

    if (providers.length === 0) return null;

    // Filter by capabilities if required
    let eligibleProviders = providers;
    if (preferences?.requireCapabilities?.length) {
      eligibleProviders = providers.filter(p => 
        preferences.requireCapabilities.every(cap => p.capabilities.includes(cap))
      );
    }

    if (eligibleProviders.length === 0) return null;

    // Apply routing strategy
    switch (preferences?.strategy || 'balanced') {
      case 'cost':
        return eligibleProviders.reduce((best, current) => 
          (current.costPerToken || 0) < (best.costPerToken || 0) ? current : best
        );
      case 'latency':
        return eligibleProviders.reduce((best, current) => 
          (current.avgResponseTime || Infinity) < (best.avgResponseTime || Infinity) ? current : best
        );
      case 'quality':
        return eligibleProviders.reduce((best, current) => 
          (current.successRate || 0) > (best.successRate || 0) ? current : best
        );
      case 'balanced':
      default:
        // Weighted scoring based on multiple factors
        return eligibleProviders.reduce((best, current) => {
          const bestScore = this.calculateProviderScore(best);
          const currentScore = this.calculateProviderScore(current);
          return currentScore > bestScore ? current : best;
        });
    }
  }

  private calculateProviderScore(provider: Provider): number {
    const latencyScore = provider.avgResponseTime ? Math.max(0, 100 - provider.avgResponseTime / 10) : 50;
    const successScore = (provider.successRate || 0) * 100;
    const costScore = provider.costPerToken ? Math.max(0, 100 - provider.costPerToken * 10000) : 50;
    const healthScore = provider.healthStatus === ProviderHealthStatus.HEALTHY ? 100 : 
                       provider.healthStatus === ProviderHealthStatus.DEGRADED ? 50 : 0;

    return (latencyScore * 0.3 + successScore * 0.4 + costScore * 0.2 + healthScore * 0.1);
  }

  private async getFallbackProvider(primaryProviderId: string, organizationId: string): Promise<Provider | null> {
    const fallbackChain = await this.prisma.providerFallbackChain.findFirst({
      where: { 
        primaryProviderId,
        isActive: true
      },
      include: {
        primaryProvider: true
      }
    });

    if (!fallbackChain) return null;

    return await this.prisma.provider.findFirst({
      where: {
        id: fallbackChain.fallbackProviderId,
        organizationId,
        isActive: true,
        healthStatus: { not: ProviderHealthStatus.UNHEALTHY }
      }
    });
  }

  private isCircuitBreakerClosed(providerId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker) return true;

    if (circuitBreaker.status === CircuitBreakerStatus.OPEN) {
      // Check if we should try half-open
      if (circuitBreaker.nextRetryTime && new Date() > circuitBreaker.nextRetryTime) {
        circuitBreaker.status = CircuitBreakerStatus.HALF_OPEN;
        return true;
      }
      return false;
    }

    return true;
  }

  private async checkRateLimit(providerId: string): Promise<boolean> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId }
    });

    if (!provider?.rateLimit) return true;

    const rateLimit = this.rateLimits.get(providerId);
    const now = new Date();

    if (!rateLimit || now > rateLimit.resetTime) {
      this.rateLimits.set(providerId, {
        count: 1,
        resetTime: new Date(now.getTime() + 60000) // 1 minute window
      });
      return true;
    }

    if (rateLimit.count >= provider.rateLimit) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  private recordCircuitBreakerFailure(providerId: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerId) || {
      status: CircuitBreakerStatus.CLOSED,
      failureCount: 0
    };

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date();

    // Open circuit breaker after 5 failures
    if (circuitBreaker.failureCount >= 5) {
      circuitBreaker.status = CircuitBreakerStatus.OPEN;
      circuitBreaker.nextRetryTime = new Date(Date.now() + 60000); // Retry after 1 minute
    }

    this.circuitBreakers.set(providerId, circuitBreaker);
  }

  private resetCircuitBreakerFailures(providerId: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (circuitBreaker) {
      circuitBreaker.failureCount = 0;
      circuitBreaker.status = CircuitBreakerStatus.CLOSED;
      circuitBreaker.lastFailureTime = undefined;
      circuitBreaker.nextRetryTime = undefined;
    }
  }

  private calculateCost(provider: Provider, tokens: number): number {
    return (provider.costPerToken || 0) * tokens;
  }

  private async recordExecution(providerId: string, organizationId: string, execution: any): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.prisma.providerUsageMetric.upsert({
        where: {
          providerId_date: {
            providerId,
            date: today
          }
        },
        update: {
          requests: { increment: 1 },
          errors: execution.success ? undefined : { increment: 1 },
          tokens: execution.tokensUsed ? { increment: execution.tokensUsed } : undefined,
          cost: execution.cost ? { increment: execution.cost } : undefined,
          avgLatency: execution.duration || 0
        },
        create: {
          providerId,
          date: today,
          requests: 1,
          errors: execution.success ? 0 : 1,
          tokens: execution.tokensUsed || 0,
          cost: execution.cost || 0,
          avgLatency: execution.duration || 0
        }
      });

      // Update provider stats
      await this.updateProviderStats(providerId, execution);
    } catch (error) {
      this.logger.error(`Error recording execution: ${error.message}`);
    }
  }

  private async updateProviderStats(providerId: string, execution: any): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId }
    });

    if (!provider) return;

    const totalRequests = provider.totalRequests + 1;
    const totalErrors = execution.success ? provider.totalErrors : provider.totalErrors + 1;
    const successRate = totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 0;
    
    // Calculate rolling average response time
    const avgResponseTime = provider.avgResponseTime ? 
      (provider.avgResponseTime * 0.9 + (execution.duration || 0) * 0.1) : 
      (execution.duration || 0);

    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        totalRequests,
        totalErrors,
        successRate,
        avgResponseTime,
        lastUsedAt: new Date()
      }
    });
  }

  private async performHealthCheck(providerId: string, organizationId: string, timeout?: number): Promise<any> {
    try {
      const provider = await this.prisma.provider.findFirst({
        where: { id: providerId, organizationId }
      });

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const client = this.providerClients.get(providerId);
      if (!client) {
        throw new BadRequestException('Provider client not initialized');
      }

      const startTime = Date.now();
      
      // Perform health check with timeout
      const healthCheckPromise = client.test({
        message: 'Health check',
        maxTokens: 5
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), timeout || 10000);
      });

      await Promise.race([healthCheckPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      const status = duration < 2000 ? ProviderHealthStatus.HEALTHY : ProviderHealthStatus.DEGRADED;

      // Record health check
      await this.prisma.providerHealthCheck.create({
        data: {
          providerId,
          status,
          responseTime: duration,
          checkedAt: new Date()
        }
      });

      // Update provider health status
      await this.updateProviderHealth(providerId, status, duration);

      return {
        success: true,
        status,
        responseTime: duration,
        timestamp: new Date()
      };
    } catch (error) {
      // Record failed health check
      await this.prisma.providerHealthCheck.create({
        data: {
          providerId,
          status: ProviderHealthStatus.UNHEALTHY,
          errorMessage: error.message,
          checkedAt: new Date()
        }
      });

      // Update provider health status
      await this.updateProviderHealth(providerId, ProviderHealthStatus.UNHEALTHY, null, error.message);

      return {
        success: false,
        status: ProviderHealthStatus.UNHEALTHY,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  private async updateProviderHealth(
    providerId: string, 
    status: ProviderHealthStatus, 
    responseTime?: number, 
    errorMessage?: string
  ): Promise<void> {
    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        healthStatus: status,
        lastHealthCheck: new Date(),
        avgResponseTime: responseTime ? responseTime : undefined
      }
    });

    // Emit health status event
    await this.emitProviderEvent('PROVIDER_HEALTH_CHANGED', providerId, null, {
      providerId,
      status,
      responseTime,
      errorMessage
    });
  }

  private startHealthCheckScheduler(): void {
    // Run health checks every 5 minutes
    setInterval(async () => {
      try {
        const providers = await this.prisma.provider.findMany({
          where: { isActive: true }
        });

        for (const provider of providers) {
          // Skip if recently checked (within last 4 minutes)
          if (provider.lastHealthCheck && 
              new Date().getTime() - provider.lastHealthCheck.getTime() < 240000) {
            continue;
          }

          await this.performHealthCheck(provider.id, provider.organizationId);
        }
      } catch (error) {
        this.logger.error(`Health check scheduler error: ${error.message}`);
      }
    }, 300000); // 5 minutes
  }

  private startMetricsAggregator(): void {
    // Aggregate metrics every hour
    setInterval(async () => {
      try {
        await this.aggregateHourlyMetrics();
      } catch (error) {
        this.logger.error(`Metrics aggregation error: ${error.message}`);
      }
    }, 3600000); // 1 hour
  }

  private async aggregateHourlyMetrics(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // This would typically aggregate metrics from Redis or other real-time storage
    // For now, we'll just ensure daily metrics are up to date
    const providers = await this.prisma.provider.findMany({
      where: { isActive: true }
    });

    for (const provider of providers) {
      // Calculate success rate and other metrics
      const recentMetrics = await this.prisma.providerUsageMetric.findMany({
        where: {
          providerId: provider.id,
          date: { gte: oneHourAgo }
        }
      });

      if (recentMetrics.length > 0) {
        const totalRequests = recentMetrics.reduce((sum, m) => sum + m.requests, 0);
        const totalErrors = recentMetrics.reduce((sum, m) => sum + m.errors, 0);
        const successRate = totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 0;

        await this.prisma.provider.update({
          where: { id: provider.id },
          data: { successRate }
        });
      }
    }
  }

  private calculatePerformanceScore(provider: Provider, metrics: ProviderUsageMetric[]): number {
    if (metrics.length === 0) return 50;

    const avgLatency = metrics.reduce((sum, m) => sum + m.avgLatency, 0) / metrics.length;
    const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    const latencyScore = Math.max(0, 100 - avgLatency / 10);
    const reliabilityScore = (1 - errorRate) * 100;

    return (latencyScore * 0.6 + reliabilityScore * 0.4);
  }

  private calculateHealthScore(provider: Provider): number {
    switch (provider.healthStatus) {
      case ProviderHealthStatus.HEALTHY: return 100;
      case ProviderHealthStatus.DEGRADED: return 60;
      case ProviderHealthStatus.UNHEALTHY: return 20;
      default: return 50;
    }
  }

  private calculateCostEfficiencyScore(provider: Provider, metrics: ProviderUsageMetric[]): number {
    if (metrics.length === 0 || !provider.costPerToken) return 50;

    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.tokens, 0);
    
    if (totalTokens === 0) return 50;

    const actualCostPerToken = totalCost / totalTokens;
    const efficiency = provider.costPerToken / actualCostPerToken;

    return Math.min(100, efficiency * 100);
  }

  private async emitProviderEvent(type: string, providerId: string | null, organizationId: string | null, data: any): Promise<void> {
    try {
      await this.apix.emitEvent({
        id: crypto.randomUUID(),
        type,
        channel: 'provider-events',
        data,
        metadata: {
          timestamp: new Date(),
          source: 'providers-service',
          organizationId,
          providerId
        }
      });
    } catch (error) {
      this.logger.error(`Error emitting provider event: ${error.message}`);
    }
  }

  private mapToProviderResponse(provider: any): ProviderResponseDto {
    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      endpoint: provider.endpoint,
      capabilities: provider.capabilities,
      isActive: provider.isActive,
      priority: provider.priority,
      rateLimit: provider.rateLimit,
      costPerToken: provider.costPerToken,
      healthStatus: provider.healthStatus,
      avgResponseTime: provider.avgResponseTime,
      successRate: provider.successRate,
      totalRequests: provider.totalRequests,
      totalErrors: provider.totalErrors,
      lastUsedAt: provider.lastUsedAt,
      lastHealthCheck: provider.lastHealthCheck,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      routingRules: provider.routingRules,
      usageMetrics: provider.usageMetrics,
      metadata: provider.metadata
    };
  }
}

// Provider Client Implementations
class OpenAIProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'gpt-3.5-turbo',
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      stream: data.stream,
      tools: data.tools
    });

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.get('/models');
    return response.data.data.map((model: any) => model.id);
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'embedding', 'function_calling', 'vision'];
  }
}

class AnthropicProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api.anthropic.com/v1',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/messages', {
      model: data.model || 'claude-3-sonnet-20240229',
      messages: data.messages,
      max_tokens: data.maxTokens || 1000,
      temperature: data.temperature,
      stream: data.stream
    });

    return {
      content: response.data.content[0].text,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/messages', {
      model: data.model || 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'function_calling'];
  }
}

class GoogleProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://generativelanguage.googleapis.com/v1beta',
      params: { key: config.apiKey },
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const model = data.model || 'gemini-pro';
    const response = await this.client.post(`/models/${model}:generateContent`, {
      contents: data.messages.map(msg => ({
        parts: [{ text: msg.content }],
        role: msg.role === 'assistant' ? 'model' : 'user'
      })),
      generationConfig: {
        temperature: data.temperature,
        maxOutputTokens: data.maxTokens
      }
    });

    return {
      content: response.data.candidates[0].content.parts[0].text,
      usage: response.data.usageMetadata,
      model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const model = data.model || 'gemini-pro';
    const response = await this.client.post(`/models/${model}:generateContent`, {
      contents: [{ parts: [{ text: data.message || 'Hello' }] }],
      generationConfig: { maxOutputTokens: data.maxTokens || 5 }
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.get('/models');
    return response.data.models.map((model: any) => model.name.split('/').pop());
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'embedding', 'vision'];
  }
}

class MistralProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api.mistral.ai/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'mistral-medium',
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      stream: data.stream
    });

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'mistral-medium',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.get('/models');
    return response.data.data.map((model: any) => model.id);
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'function_calling'];
  }
}

class GroqProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api.groq.com/openai/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'mixtral-8x7b-32768',
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      stream: data.stream
    });

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.get('/models');
    return response.data.data.map((model: any) => model.id);
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion'];
  }
}

class DeepSeekProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api.deepseek.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'deepseek-chat',
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      stream: data.stream
    });

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'deepseek-chat',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    return ['deepseek-chat', 'deepseek-coder'];
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'function_calling'];
  }
}

class HuggingFaceProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://api-inference.huggingface.co',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const model = data.model || 'microsoft/DialoGPT-medium';
    const response = await this.client.post(`/models/${model}`, {
      inputs: data.messages[data.messages.length - 1].content,
      parameters: {
        temperature: data.temperature,
        max_new_tokens: data.maxTokens
      }
    });

    return {
      content: response.data[0].generated_text,
      usage: { total_tokens: 0 },
      model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const model = data.model || 'microsoft/DialoGPT-medium';
    const response = await this.client.post(`/models/${model}`, {
      inputs: data.message || 'Hello',
      parameters: { max_new_tokens: data.maxTokens || 5 }
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    return ['microsoft/DialoGPT-medium', 'microsoft/DialoGPT-large', 'facebook/blenderbot-400M-distill'];
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'embedding'];
  }
}

class OpenRouterProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'openai/gpt-3.5-turbo',
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      stream: data.stream
    });

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/chat/completions', {
      model: data.model || 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.get('/models');
    return response.data.data.map((model: any) => model.id);
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'function_calling'];
  }
}

class OllamaProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'http://localhost:11434',
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/api/chat', {
      model: data.model || 'llama2',
      messages: data.messages,
      stream: false,
      options: {
        temperature: data.temperature,
        num_predict: data.maxTokens
      }
    });

    return {
      content: response.data.message.content,
      usage: { total_tokens: 0 },
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/api/chat', {
      model: data.model || 'llama2',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      stream: false,
      options: { num_predict: data.maxTokens || 5 }
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.get('/api/tags');
    return response.data.models.map((model: any) => model.name);
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'embedding'];
  }
}

class LocalAIProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint || 'http://localhost:8080',
      headers: {
        'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : undefined,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post('/v1/chat/completions', {
      model: data.model || 'gpt-3.5-turbo',
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      stream: data.stream
    });

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post('/v1/chat/completions', {
      model: data.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    const response = await this.client.get('/v1/models');
    return response.data.data.map((model: any) => model.id);
  }

  async getCapabilities(): Promise<string[]> {
    return ['chat', 'completion', 'embedding'];
  }
}

class CustomProviderClient implements ProviderClient {
  private client: AxiosInstance;

  constructor(private config: any) {
    this.client = axios.create({
      baseURL: config.endpoint,
      headers: {
        'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : undefined,
        'Content-Type': 'application/json',
        ...config.headers
      },
      timeout: 30000
    });
  }

  async execute(data: ExecuteProviderDto): Promise<any> {
    const response = await this.client.post(this.config.chatEndpoint || '/chat/completions', {
      model: data.model,
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
      stream: data.stream,
      ...this.config.additionalParams
    });

    return {
      content: response.data.choices?.[0]?.message?.content || response.data.content,
      usage: response.data.usage,
      model: response.data.model || data.model
    };
  }

  async test(data: TestProviderDto): Promise<any> {
    const response = await this.client.post(this.config.chatEndpoint || '/chat/completions', {
      model: data.model,
      messages: [{ role: 'user', content: data.message || 'Hello' }],
      max_tokens: data.maxTokens || 5,
      ...this.config.additionalParams
    });

    return response.data;
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.client.get(this.config.modelsEndpoint || '/models');
      return response.data.data?.map((model: any) => model.id) || response.data.models || [];
    } catch (error) {
      return ['custom-model'];
    }
  }

  async getCapabilities(): Promise<string[]> {
    return this.config.capabilities || ['chat', 'completion'];
  }
}