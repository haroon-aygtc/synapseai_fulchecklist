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
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ProviderType } from '@prisma/client';

@Controller('providers')
@UseGuards(JwtAuthGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('providers:create')
  async createProvider(@Request() req: any, @Body() createProviderDto: any) {
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
    @Query('isActive') isActive?: string
  ) {
    const filters: any = {};
    if (type) filters.type = type;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    return this.providersService.getProviders(req.user.organizationId, filters);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProvider(@Request() req: any, @Param('id') id: string) {
    return this.providersService.getProvider(id, req.user.organizationId);
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @Permissions('providers:update')
  async updateProvider(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateProviderDto: any
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
  async deleteProvider(@Request() req: any, @Param('id') id: string) {
    await this.providersService.deleteProvider(id, req.user.organizationId);
  }

  @Post('execute')
  @UseGuards(PermissionGuard)
  @Permissions('providers:execute')
  async executeWithSmartRouting(
    @Request() req: any,
    @Body() executeDto: any
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
    @Param('id') id: string,
    @Body() executeDto: any
  ) {
    return this.providersService.executeWithProvider(id, executeDto);
  }

  @Get(':id/analytics')
  @UseGuards(PermissionGuard)
  @Permissions('providers:read')
  async getProviderAnalytics(@Request() req: any, @Param('id') id: string) {
    return this.providersService.getProviderAnalytics(id, req.user.organizationId);
  }

  @Post(':id/test')
  @UseGuards(PermissionGuard)
  @Permissions('providers:execute')
  async testProvider(
    @Request() req: any,
    @Param('id') id: string,
    @Body() testDto: any
  ) {
    return this.providersService.executeWithProvider(id, {
      messages: [{ role: 'user', content: testDto.message || 'Hello, this is a test.' }],
      maxTokens: 50
    });
  }
}