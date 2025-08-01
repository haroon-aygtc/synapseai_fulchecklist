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