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
  ValidationPipe
} from '@nestjs/common';
import { ToolsService } from './tools.service';
import { EnhancedPermissionGuard } from '../../common/guards/enhanced-permission.guard';
import { Permissions } from '../../common/decorators/enhanced-permissions.decorator';
import { OrganizationId, CurrentUser } from '../../common/decorators/enhanced-permissions.decorator';
import { CreateToolDto, UpdateToolDto, ExecuteToolDto, GetToolsQueryDto } from './dto/tool.dto';

@Controller('tools')
@UseGuards(EnhancedPermissionGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  @Permissions('tool:read')
  async getTools(
    @OrganizationId() organizationId: string,
    @Query() query: GetToolsQueryDto
  ) {
    const tools = await this.toolsService.findAll(organizationId, query);
    return { tools };
  }

  @Get('templates')
  @Permissions('tool:read')
  async getTemplates(@OrganizationId() organizationId: string) {
    const templates = await this.toolsService.getTemplates(organizationId);
    return { templates };
  }

  @Get(':id')
  @Permissions('tool:read')
  async getTool(
    @Param('id') toolId: string,
    @OrganizationId() organizationId: string
  ) {
    return this.toolsService.findOne(toolId, organizationId);
  }

  @Post()
  @Permissions('tool:write')
  async createTool(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: any,
    @Body(ValidationPipe) createToolDto: CreateToolDto
  ) {
    return this.toolsService.create(organizationId, user.sub, createToolDto);
  }

  @Put(':id')
  @Permissions('tool:write')
  async updateTool(
    @Param('id') toolId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: any,
    @Body(ValidationPipe) updateToolDto: UpdateToolDto
  ) {
    return this.toolsService.update(toolId, organizationId, user.sub, updateToolDto);
  }

  @Delete(':id')
  @Permissions('tool:delete')
  async deleteTool(
    @Param('id') toolId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: any
  ) {
    await this.toolsService.remove(toolId, organizationId, user.sub);
    return { message: 'Tool deleted successfully' };
  }

  @Post(':id/execute')
  @Permissions('tool:execute')
  async executeTool(
    @Param('id') toolId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: any,
    @Body(ValidationPipe) executeDto: ExecuteToolDto
  ) {
    return this.toolsService.execute(toolId, organizationId, user.sub, executeDto);
  }

  @Get(':id/executions')
  @Permissions('tool:read')
  async getToolExecutions(
    @Param('id') toolId: string,
    @OrganizationId() organizationId: string,
    @Query('limit') limit: number = 50
  ) {
    return this.toolsService.getExecutions(toolId, organizationId, limit);
  }

  @Get(':id/performance')
  @Permissions('tool:read')
  async getToolPerformance(
    @Param('id') toolId: string,
    @OrganizationId() organizationId: string
  ) {
    return this.toolsService.getPerformanceMetrics(toolId, organizationId);
  }

  @Post(':id/test')
  @Permissions('tool:execute')
  async testTool(
    @Param('id') toolId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: any,
    @Body() testData: any
  ) {
    return this.toolsService.test(toolId, organizationId, user.sub, testData);
  }
}