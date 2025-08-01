import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, IsObject, Min, Max, IsUrl } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProviderType, ProviderHealthStatus } from '@prisma/client';

export class CreateProviderDto {
  @IsString()
  name: string;

  @IsEnum(ProviderType)
  type: ProviderType;

  @IsOptional()
  @IsUrl()
  endpoint?: string;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerToken?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;

  @IsOptional()
  @IsUrl()
  endpoint?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerToken?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ExecuteProviderDto {
  @IsArray()
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @IsOptional()
  @IsArray()
  tools?: any[];
}

export class SmartRoutingPreferencesDto {
  @IsOptional()
  @IsString()
  preferredProvider?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLatency?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requireCapabilities?: string[];

  @IsOptional()
  @IsEnum(['cost', 'latency', 'quality', 'balanced'])
  strategy?: 'cost' | 'latency' | 'quality' | 'balanced';

  @IsOptional()
  @IsBoolean()
  enableFallback?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxRetries?: number;
}

export class ExecuteWithSmartRoutingDto {
  @Type(() => ExecuteProviderDto)
  data: ExecuteProviderDto;

  @IsOptional()
  @Type(() => SmartRoutingPreferencesDto)
  preferences?: SmartRoutingPreferencesDto;
}

export class TestProviderDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxTokens?: number;
}

export class CreateRoutingRuleDto {
  @IsString()
  providerId: string;

  @IsObject()
  condition: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  fallback?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateRoutingRuleDto {
  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  fallback?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateFallbackChainDto {
  @IsString()
  primaryProviderId: string;

  @IsString()
  fallbackProviderId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;
}

export class ProviderAnalyticsQueryDto {
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  startDate?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  endDate?: Date;

  @IsOptional()
  @IsEnum(['hour', 'day', 'week', 'month'])
  granularity?: 'hour' | 'day' | 'week' | 'month';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}

export class ProviderHealthCheckDto {
  @IsOptional()
  @IsBoolean()
  includeMetrics?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(30000)
  timeout?: number;
}

export class BulkProviderOperationDto {
  @IsArray()
  @IsString({ each: true })
  providerIds: string[];

  @IsEnum(['activate', 'deactivate', 'delete', 'health_check'])
  operation: 'activate' | 'deactivate' | 'delete' | 'health_check';

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;
}

export class ProviderConfigValidationDto {
  @IsEnum(ProviderType)
  type: ProviderType;

  @IsOptional()
  @IsUrl()
  endpoint?: string;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class ProviderResponseDto {
  id: string;
  name: string;
  type: ProviderType;
  endpoint?: string;
  capabilities: string[];
  isActive: boolean;
  priority: number;
  rateLimit?: number;
  costPerToken?: number;
  healthStatus: ProviderHealthStatus;
  avgResponseTime?: number;
  successRate?: number;
  totalRequests: number;
  totalErrors: number;
  lastUsedAt?: Date;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
  routingRules?: any[];
  usageMetrics?: any[];
  metadata?: Record<string, any>;
}

export class ProviderExecutionResultDto {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model: string;
  provider: {
    id: string;
    name: string;
    type: ProviderType;
  };
  metadata: {
    duration: number;
    tokensUsed: number;
    cost: number;
    attempts: number;
    strategy: string;
    fallbackUsed?: boolean;
    circuitBreakerTriggered?: boolean;
  };
}

export class ProviderAnalyticsDto {
  provider: ProviderResponseDto;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  dailyMetrics: Array<{
    date: Date;
    requests: number;
    errors: number;
    cost: number;
    avgLatency: number;
  }>;
  performanceScore: number;
  healthScore: number;
  costEfficiencyScore: number;
}

// A/B Testing DTOs
export class CreateABTestDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  providerIds: string[];

  @IsNumber()
  @Min(0)
  @Max(100)
  trafficSplit: number;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @IsOptional()
  @IsString()
  @IsEnum(['requests', 'users', 'time'])
  splitType?: 'requests' | 'users' | 'time';

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number; // in hours

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];
}

export class UpdateABTestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  trafficSplit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;
}

export class ABTestResultsDto {
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  startDate?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  endDate?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @IsOptional()
  @IsEnum(['hourly', 'daily', 'weekly'])
  granularity?: 'hourly' | 'daily' | 'weekly';
}

// Custom Routing Rules DTOs
export class CreateCustomRoutingRuleDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsObject()
  conditions: {
    requestProperties?: {
      model?: string[];
      temperature?: { min?: number; max?: number };
      maxTokens?: { min?: number; max?: number };
      messageCount?: { min?: number; max?: number };
      hasTools?: boolean;
      hasImages?: boolean;
      userTier?: string[];
      organizationId?: string[];
    };
    timeConditions?: {
      timeOfDay?: { start: string; end: string };
      dayOfWeek?: number[];
      timezone?: string;
    };
    loadConditions?: {
      maxConcurrentRequests?: number;
      avgResponseTime?: { max: number };
      errorRate?: { max: number };
    };
    costConditions?: {
      maxCostPerRequest?: number;
      dailyBudgetRemaining?: { min: number };
    };
  };

  @IsObject()
  actions: {
    providerSelection?: {
      preferredProviders?: string[];
      excludedProviders?: string[];
      strategy?: 'cost' | 'latency' | 'quality' | 'balanced';
      weights?: {
        cost?: number;
        latency?: number;
        quality?: number;
      };
    };
    fallbackBehavior?: {
      enableFallback?: boolean;
      maxRetries?: number;
      fallbackProviders?: string[];
    };
    rateLimiting?: {
      requestsPerMinute?: number;
      burstLimit?: number;
    };
    caching?: {
      enableCaching?: boolean;
      ttl?: number;
    };
  };

  @IsNumber()
  @Min(0)
  @Max(100)
  priority: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateCustomRoutingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  conditions?: any;

  @IsOptional()
  @IsObject()
  actions?: any;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class TestCustomRoutingRuleDto {
  @IsObject()
  requestContext: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    messages?: Array<{ role: string; content: string }>;
    tools?: any[];
    userId?: string;
    organizationId?: string;
    userTier?: string;
    timestamp?: Date;
  };

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

// Real-time Monitoring DTOs
export class MonitoringConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providerIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  updateInterval?: number; // milliseconds

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @IsOptional()
  @IsBoolean()
  includeHistoricalData?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  historicalHours?: number;
}

export class RealTimeMetricsDto {
  providerId: string;
  providerName: string;
  providerType: string;
  timestamp: Date;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  metrics: {
    activeRequests: number;
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
    successRate: number;
    queueLength: number;
    circuitBreakerStatus: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    rateLimitRemaining: number;
    costPerMinute: number;
    tokensPerMinute: number;
  };
  alerts?: Array<{
    type: 'WARNING' | 'ERROR' | 'CRITICAL';
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
}

export class MonitoringAlertDto {
  @IsString()
  @IsEnum(['WARNING', 'ERROR', 'CRITICAL'])
  type: 'WARNING' | 'ERROR' | 'CRITICAL';

  @IsString()
  message: string;

  @IsString()
  providerId: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  autoResolve?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(60)
  autoResolveAfter?: number; // seconds
}

export class AcknowledgeAlertDto {
  @IsString()
  alertId: string;

  @IsOptional()
  @IsString()
  note?: string;
}

// Enhanced Analytics DTOs
export class AdvancedAnalyticsQueryDto extends ProviderAnalyticsQueryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providerIds?: string[];

  @IsOptional()
  @IsBoolean()
  includeABTests?: boolean;

  @IsOptional()
  @IsBoolean()
  includeRoutingRules?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(['provider', 'model', 'user', 'organization'])
  groupBy?: 'provider' | 'model' | 'user' | 'organization';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filters?: string[];

  @IsOptional()
  @IsObject()
  customFilters?: Record<string, any>;
}

export class ABTestAnalyticsDto {
  testId: string;
  testName: string;
  status: 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  startDate: Date;
  endDate?: Date;
  duration: number; // hours
  totalRequests: number;
  variants: Array<{
    providerId: string;
    providerName: string;
    trafficPercentage: number;
    requests: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
    errorRate: number;
    userSatisfactionScore?: number;
  }>;
  statisticalSignificance: {
    isSignificant: boolean;
    confidenceLevel: number;
    pValue: number;
    winner?: string;
  };
  metrics: {
    primaryMetric: string;
    primaryMetricImprovement: number;
    secondaryMetrics: Array<{
      name: string;
      improvement: number;
      significance: number;
    }>;
  };
  recommendations: Array<{
    type: 'CONTINUE' | 'STOP' | 'EXTEND' | 'MODIFY';
    reason: string;
    confidence: number;
  }>;
}

export class RoutingRuleAnalyticsDto {
  ruleId: string;
  ruleName: string;
  isActive: boolean;
  matchCount: number;
  executionCount: number;
  successRate: number;
  avgExecutionTime: number;
  impactMetrics: {
    costSavings: number;
    latencyImprovement: number;
    errorReduction: number;
    userSatisfactionImprovement: number;
  };
  topMatchingConditions: Array<{
    condition: string;
    matchCount: number;
    successRate: number;
  }>;
  performanceByTimeOfDay: Array<{
    hour: number;
    matchCount: number;
    successRate: number;
    avgLatency: number;
  }>;
}