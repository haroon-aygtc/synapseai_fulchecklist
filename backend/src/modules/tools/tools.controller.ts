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
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ToolsService } from './tools.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, ToolType } from '@prisma/client';

@Controller('tools')
@UseGuards(JwtAuthGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_CREATE)
  async createTool(@Request() req, @Body() createToolDto: any) {
    return this.toolsService.createTool(
      req.user.sub,
      req.user.organizationId,
      createToolDto
    );
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_READ)
  async getTools(
    @Request() req,
    @Query('type') type?: ToolType,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string
  ) {
    const filters: any = {};
    
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search;

    return this.toolsService.getTools(req.user.organizationId, filters);
  }

  @Get('categories')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_READ)
  async getToolCategories(@Request() req) {
    return this.toolsService.getToolCategories(req.user.organizationId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_READ)
  async getTool(@Request() req, @Param('id') id: string) {
    return this.toolsService.getTool(id, req.user.organizationId);
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_UPDATE)
  async updateTool(
    @Request() req,
    @Param('id') id: string,
    @Body() updateToolDto: any
  ) {
    return this.toolsService.updateTool(id, req.user.organizationId, updateToolDto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTool(@Request() req, @Param('id') id: string) {
    await this.toolsService.deleteTool(id, req.user.organizationId);
  }

  @Post(':id/execute')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_EXECUTE)
  async executeTool(
    @Request() req,
    @Param('id') id: string,
    @Body() executeDto: any
  ) {
    return this.toolsService.executeTool(
      id,
      req.user.organizationId,
      executeDto
    );
  }

  @Post(':id/test')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_EXECUTE)
  async testTool(
    @Request() req,
    @Param('id') id: string,
    @Body() testDto: any
  ) {
    return this.toolsService.testTool(
      id,
      req.user.organizationId,
      testDto.input
    );
  }

  @Get(':id/analytics')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.TOOL_READ)
  async getToolAnalytics(@Request() req, @Param('id') id: string) {
    return this.toolsService.getToolAnalytics(id, req.user.organizationId);
  }
}