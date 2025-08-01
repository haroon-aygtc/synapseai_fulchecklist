import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  Param,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { EnhancedAuthService, SwitchOrganizationDto, InviteUserDto } from './enhanced-auth.service';
import { EnhancedJwtStrategy } from './strategies/enhanced-jwt.strategy';
import { EnhancedPermissionGuard } from '../../common/guards/enhanced-permission.guard';
import {
  Permissions,
  Roles,
  Public,
  CurrentUser,
  OrganizationContext,
  OrganizationId,
} from '../../common/decorators/enhanced-permissions.decorator';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  Enable2FADto,
  Verify2FADto,
  RefreshTokenDto,
} from './dto/auth.dto';
import { Role } from '@prisma/client';

@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class EnhancedAuthController {
  constructor(private readonly authService: EnhancedAuthService) {}

  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EnhancedPermissionGuard)
  async switchOrganization(
    @CurrentUser() user: any,
    @Body() switchDto: SwitchOrganizationDto
  ) {
    return this.authService.switchOrganization(user.sub, switchDto);
  }

  @Post('invite-user')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EnhancedPermissionGuard)
  @Permissions('user:invite')
  @Roles(Role.ORG_ADMIN, Role.SUPER_ADMIN)
  async inviteUser(
    @CurrentUser() user: any,
    @OrganizationId() organizationId: string,
    @Body() inviteDto: InviteUserDto
  ) {
    return this.authService.inviteUser(user.sub, organizationId, inviteDto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EnhancedPermissionGuard)
  async logout(@CurrentUser() user: any, @Body() body: { refreshToken?: string }) {
    return this.authService.logout(user.sub, body.refreshToken);
  }

  @Get('me')
  @UseGuards(EnhancedPermissionGuard)
  async getProfile(@CurrentUser() user: any, @OrganizationContext() orgContext: any) {
    return {
      user: user.user,
      organization: user.organization,
      permissions: user.permissions,
      role: user.role,
      membershipId: user.membershipId,
      context: orgContext,
    };
  }

  @Get('organizations')
  @UseGuards(EnhancedPermissionGuard)
  async getUserOrganizations(@CurrentUser() user: any) {
    // This would need to be implemented in the service
    // For now, return the available organizations from login
    return {
      organizations: [], // TODO: Implement getUserOrganizations in service
      current: user.organization,
    };
  }

  @Get('permissions')
  @UseGuards(EnhancedPermissionGuard)
  async getUserPermissions(@CurrentUser() user: any) {
    return {
      permissions: user.permissions,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  // ... (Include other endpoints like forgotPassword, resetPassword, etc.)

  @Get('health')
  @Public()
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'enhanced-auth',
      version: '2.0.0',
    };
  }
}