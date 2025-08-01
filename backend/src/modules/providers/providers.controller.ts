import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UsePipes,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ProviderType } from '@prisma/client';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ExecuteProviderDto,
  ExecuteWithSmartRoutingDto,
  TestProviderDto,
  CreateRoutingRuleDto,
  UpdateRoutingRuleDto,
  CreateFallbackChainDto,
  ProviderAnalyticsQueryDto,
  ProviderHealthCheckDto,
  BulkProviderOperationDto,
  ProviderConfigValidationDto,
} from './dto/provider.dto';

@Controller('providers')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  // CRUD Operations
  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('providers:create')
  async createProvider(@Request() req: any, @Body() createProviderDto: CreateProviderDto) {
    return this.providersService.createProvider(
      req.user.id,
      req.user.organizationId,
      createProviderDto
    );
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProviders(
    @Request() req: any,
    @Query('type') type?: ProviderType,
    @Query('isActive') isActive?: string,
    @Query('includeMetrics') includeMetrics?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const filters: any = {};
    if (type) filters.type = type;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const options = {
      includeMetrics: includeMetrics === 'true',
      sortBy: sortBy || 'priority',
      sortOrder: sortOrder || 'desc',
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };

    return this.providersService.getProviders(req.user.organizationId, filters, options);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProvider(
    @Request() req: any, 
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeMetrics') includeMetrics?: string
  ) {
    return this.providersService.getProvider(
      id, 
      req.user.organizationId,
      { includeMetrics: includeMetrics === 'true' }
    );
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async updateProvider(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProviderDto: UpdateProviderDto
  ) {
    return this.providersService.updateProvider(
      id,
      req.user.organizationId,
      updateProviderDto
    );
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('providers:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.providersService.deleteProvider(id, req.user.organizationId);
  }

  // Execution Endpoints
  @Post('execute')
  @UseGuards(PermissionGuard)
  @Permissions('providers:execute')
  async executeWithSmartRouting(
    @Request() req: any,
    @Body() executeDto: ExecuteWithSmartRoutingDto
  ) {
    return this.providersService.executeWithSmartRouting(
      req.user.organizationId,
      executeDto.data,
      executeDto.preferences
    );
  }

  @Post(':id/execute')
  @UseGuards(PermissionGuard)
  @Permissions('providers:execute')
  async executeWithProvider(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() executeDto: ExecuteProviderDto
  ) {
    return this.providersService.executeWithProvider(id, executeDto);
  }

  @Post(':id/execute/stream')
  @UseGuards(PermissionGuard)
  @Permissions('providers:execute')
  async executeWithProviderStream(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() executeDto: ExecuteProviderDto
  ) {
    return this.providersService.executeWithProviderStream(id, executeDto);
  }

  // Testing Endpoints
  @Post(':id/test')
  @UseGuards(PermissionGuard)
  @Permissions('providers:execute')
  async testProvider(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() testDto: TestProviderDto
  ) {
    return this.providersService.testProvider(id, req.user.organizationId, testDto);
  }

  @Post('test/config')
  @UseGuards(PermissionGuard)
  @Permissions('providers:create')
  async testProviderConfig(
    @Request() req: any,
    @Body() configDto: ProviderConfigValidationDto
  ) {
    return this.providersService.testProviderConfig(configDto);
  }

  @Post('test/bulk')
  @UseGuards(PermissionGuard)
  @Permissions('providers:execute')
  async bulkTestProviders(
    @Request() req: any,
    @Body() bulkDto: BulkProviderOperationDto
  ) {
    return this.providersService.bulkTestProviders(req.user.organizationId, bulkDto.providerIds);
  }

  // Health Check Endpoints
  @Post(':id/health')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async checkProviderHealth(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() healthDto: ProviderHealthCheckDto
  ) {
    return this.providersService.checkProviderHealth(
      id, 
      req.user.organizationId, 
      healthDto
    );
  }

  @Get(':id/health/history')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProviderHealthHistory(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.providersService.getProviderHealthHistory(
      id,
      req.user.organizationId,
      {
        limit: limit ? parseInt(limit) : 100,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      }
    );
  }

  // Analytics Endpoints
  @Get(':id/analytics')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProviderAnalytics(
    @Request() req: any, 
    @Param('id', ParseUUIDPipe) id: string,
    @Query() queryDto: ProviderAnalyticsQueryDto
  ) {
    return this.providersService.getProviderAnalytics(id, req.user.organizationId, queryDto);
  }

  @Get('analytics/overview')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProvidersOverview(
    @Request() req: any,
    @Query() queryDto: ProviderAnalyticsQueryDto
  ) {
    return this.providersService.getProvidersOverview(req.user.organizationId, queryDto);
  }

  @Get('analytics/costs')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProvidersCostAnalytics(
    @Request() req: any,
    @Query() queryDto: ProviderAnalyticsQueryDto
  ) {
    return this.providersService.getProvidersCostAnalytics(req.user.organizationId, queryDto);
  }

  @Get('analytics/performance')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProvidersPerformanceAnalytics(
    @Request() req: any,
    @Query() queryDto: ProviderAnalyticsQueryDto
  ) {
    return this.providersService.getProvidersPerformanceAnalytics(req.user.organizationId, queryDto);
  }

  // Routing Rules Management
  @Post(':id/routing-rules')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async createRoutingRule(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() routingRuleDto: CreateRoutingRuleDto
  ) {
    return this.providersService.createRoutingRule(
      id,
      req.user.organizationId,
      routingRuleDto
    );
  }

  @Get(':id/routing-rules')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getRoutingRules(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.providersService.getRoutingRules(id, req.user.organizationId);
  }

  @Put('routing-rules/:ruleId')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async updateRoutingRule(
    @Request() req: any,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() updateDto: UpdateRoutingRuleDto
  ) {
    return this.providersService.updateRoutingRule(
      ruleId,
      req.user.organizationId,
      updateDto
    );
  }

  @Delete('routing-rules/:ruleId')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoutingRule(
    @Request() req: any,
    @Param('ruleId', ParseUUIDPipe) ruleId: string
  ) {
    await this.providersService.deleteRoutingRule(ruleId, req.user.organizationId);
  }

  // Fallback Chain Management
  @Post('fallback-chains')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async createFallbackChain(
    @Request() req: any,
    @Body() fallbackDto: CreateFallbackChainDto
  ) {
    return this.providersService.createFallbackChain(
      req.user.organizationId,
      fallbackDto
    );
  }

  @Get('fallback-chains')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getFallbackChains(@Request() req: any) {
    return this.providersService.getFallbackChains(req.user.organizationId);
  }

  @Delete('fallback-chains/:chainId')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFallbackChain(
    @Request() req: any,
    @Param('chainId', ParseUUIDPipe) chainId: string
  ) {
    await this.providersService.deleteFallbackChain(chainId, req.user.organizationId);
  }

  // Bulk Operations
  @Post('bulk')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async bulkOperation(
    @Request() req: any,
    @Body() bulkDto: BulkProviderOperationDto
  ) {
    return this.providersService.bulkOperation(
      req.user.organizationId,
      bulkDto.operation,
      bulkDto.providerIds,
      bulkDto.parameters
    );
  }

  // Models and Capabilities
  @Get(':id/models')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProviderModels(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.providersService.getProviderModels(id, req.user.organizationId);
  }

  @Get(':id/capabilities')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProviderCapabilities(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.providersService.getProviderCapabilities(id, req.user.organizationId);
  }

  // Circuit Breaker Management
  @Post(':id/circuit-breaker/reset')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async resetCircuitBreaker(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.providersService.resetCircuitBreaker(id, req.user.organizationId);
  }

  @Get(':id/circuit-breaker/status')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getCircuitBreakerStatus(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.providersService.getCircuitBreakerStatus(id, req.user.organizationId);
  }

  // Rate Limiting
  @Get(':id/rate-limit/status')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getRateLimitStatus(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.providersService.getRateLimitStatus(id, req.user.organizationId);
  }

  @Post(':id/rate-limit/reset')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async resetRateLimit(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.providersService.resetRateLimit(id, req.user.organizationId);
  }

  // System Status
  @Get('system/status')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getSystemStatus(@Request() req: any) {
    return this.providersService.getSystemStatus(req.user.organizationId);
  }

  @Get('system/metrics')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getSystemMetrics(@Request() req: any) {
    return this.providersService.getSystemMetrics(req.user.organizationId);
  }
}