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
  HttpStatus,
  Sse,
  MessageEvent
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, AgentType } from '@prisma/client';
import { Observable, map } from 'rxjs';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_CREATE)
  async createAgent(@Request() req, @Body() createAgentDto: any) {
    return this.agentsService.createAgent(
      req.user.sub,
      req.user.organizationId,
      createAgentDto
    );
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_READ)
  async getAgents(
    @Request() req,
    @Query('type') type?: AgentType,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string
  ) {
    const filters: any = {};
    
    if (type) filters.type = type;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search;

    return this.agentsService.getAgents(req.user.organizationId, filters);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_READ)
  async getAgent(@Request() req, @Param('id') id: string) {
    return this.agentsService.getAgent(id, req.user.organizationId);
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_UPDATE)
  async updateAgent(
    @Request() req,
    @Param('id') id: string,
    @Body() updateAgentDto: any
  ) {
    return this.agentsService.updateAgent(id, req.user.organizationId, updateAgentDto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAgent(@Request() req, @Param('id') id: string) {
    await this.agentsService.deleteAgent(id, req.user.organizationId);
  }

  @Post(':id/execute')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_EXECUTE)
  async executeAgent(
    @Request() req,
    @Param('id') id: string,
    @Body() executeDto: any
  ) {
    const result = await this.agentsService.executeAgent(
      id,
      req.user.organizationId,
      executeDto
    );

    if (executeDto.stream) {
      // For streaming responses, we'll use SSE
      return { sessionId: result.sessionId, streaming: true };
    }

    return result;
  }

  @Sse(':id/execute/stream')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_EXECUTE)
  async executeAgentStream(
    @Request() req,
    @Param('id') id: string,
    @Query('sessionId') sessionId: string,
    @Query('message') message: string
  ): Promise<Observable<MessageEvent>> {
    const result = await this.agentsService.executeAgent(
      id,
      req.user.organizationId,
      { message, sessionId, stream: true }
    );

    return new Observable(observer => {
      (async () => {
        try {
          if (result.stream) {
            for await (const chunk of result.stream) {
              observer.next({
                data: JSON.stringify({ type: 'chunk', content: chunk })
              } as MessageEvent);
            }
          }
          observer.next({
            data: JSON.stringify({ type: 'complete' })
          } as MessageEvent);
          observer.complete();
        } catch (error) {
          observer.next({
            data: JSON.stringify({ type: 'error', error: error.message })
          } as MessageEvent);
          observer.error(error);
        }
      })();
    });
  }

  @Get(':id/sessions')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_READ)
  async getAgentSessions(@Request() req, @Param('id') id: string) {
    return this.agentsService.getAgentSessions(id, req.user.organizationId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_EXECUTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async endSession(@Request() req, @Param('sessionId') sessionId: string) {
    await this.agentsService.endSession(sessionId, req.user.organizationId);
  }

  @Get(':id/analytics')
  @UseGuards(PermissionGuard)
  @RequirePermissions(Permission.AGENT_READ)
  async getAgentAnalytics(@Request() req, @Param('id') id: string) {
    return this.agentsService.getAgentAnalytics(id, req.user.organizationId);
  }
}