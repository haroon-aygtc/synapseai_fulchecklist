import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApixService } from './apix.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApixEvent } from './interfaces/apix.interfaces';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('apix')
@Controller('apix')
export class ApixController {
  constructor(private readonly apixService: ApixService) {}

  @Post('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DEVELOPER', 'ORG_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Emit an event through the APIX system' })
  @ApiResponse({ status: 201, description: 'Event emitted successfully' })
  async emitEvent(@Body() event: ApixEvent): Promise<{ success: boolean; eventId: string }> {
    await this.apixService.emitEvent(event);
    return { success: true, eventId: event.id };
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent events' })
  @ApiResponse({ status: 200, description: 'List of recent events' })
  async getRecentEvents(
    @Query('channel') channel?: string,
    @Query('limit') limit?: number,
    @Query('organizationId') organizationId?: string,
  ): Promise<ApixEvent[]> {
    return this.apixService.getRecentEvents(channel, limit, organizationId);
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORG_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get APIX metrics' })
  @ApiResponse({ status: 200, description: 'APIX metrics' })
  async getMetrics(
    @Query('organizationId') organizationId?: string,
  ) {
    return this.apixService.getMetrics(organizationId);
  }

  @Get('health')
  @ApiOperation({ summary: 'Check APIX health status' })
  @ApiResponse({ status: 200, description: 'APIX health status' })
  async getHealth() {
    return {
      status: 'ok',
      timestamp: new Date(),
      version: '1.0.0',
    };
  }
}