import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsNumber, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ToolType {
  FUNCTION = 'function',
  API = 'api',
  RAG = 'rag',
  BROWSER = 'browser',
  DATABASE = 'database',
  WEBHOOK = 'webhook',
  CUSTOM = 'custom'
}

export enum ToolStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  DEPRECATED = 'deprecated'
}

export class CreateToolDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(ToolType)
  type: ToolType;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsObject()
  authentication?: Record<string, any>;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, any>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @IsOptional()
  @IsEnum(ToolStatus)
  status?: ToolStatus = ToolStatus.DRAFT;

  @IsOptional()
  @IsString()
  version?: string = '1.0.0';

  @IsOptional()
  @IsNumber()
  timeout?: number = 30000;

  @IsOptional()
  @IsNumber()
  retryCount?: number = 3;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = false;
}

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ToolType)
  type?: ToolType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsObject()
  authentication?: Record<string, any>;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, any>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @IsOptional()
  @IsEnum(ToolStatus)
  status?: ToolStatus;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class ExecuteToolDto {
  @IsObject()
  input: Record<string, any>;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

export class GetToolsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(ToolType)
  type?: ToolType;

  @IsOptional()
  @IsEnum(ToolStatus)
  status?: ToolStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  tags?: string[];

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  offset?: number = 0;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeUsage?: boolean = false;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includePerformance?: boolean = false;
}