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
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '@prisma/client';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.WORKFLOW_CREATE)
  async createWorkflow(@Request() req, @Body() createWorkflowDto: any) {
    return this.workflowsService.createWorkflow(
      req.user.sub,
      req.user.organizationId,
      createWorkflowDto
    );
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.WORKFLOW_READ)
  async getWorkflows(
    @Request() req,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string
  ) {
    const filters: any = {};
    
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search;

    return this.workflowsService.getWorkflows(req.user.organizationId, filters);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.WORKFLOW_READ)
  async getWorkflow(@Request() req, @Param('id') id: string) {
    return this.workflowsService.getWorkflow(id, req.user.organizationId);
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.WORKFLOW_UPDATE)
  async updateWorkflow(
    @Request() req,
    @Param('id') id: string,
    @Body() updateWorkflowDto: any
  ) {
    return this.workflowsService.updateWorkflow(id, req.user.organizationId, updateWorkflowDto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.WORKFLOW_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkflow(@Request() req, @Param('id') id: string) {
    await this.workflowsService.deleteWorkflow(id, req.user.organizationId);
  }

  @Post(':id/execute')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.WORKFLOW_EXECUTE)
  async executeWorkflow(
    @Request() req,
    @Param('id') id: string,
    @Body() executeDto: any
  ) {
    return this.workflowsService.executeWorkflow(
      id,
      req.user.organizationId,
      req.user.sub,
      executeDto
    );
  }

  @Get(':id/analytics')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.WORKFLOW_READ)
  async getWorkflowAnalytics(@Request() req, @Param('id') id: string) {
    return this.workflowsService.getWorkflowAnalytics(id, req.user.organizationId);
  }
}