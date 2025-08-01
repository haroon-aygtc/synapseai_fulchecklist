import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EmailService } from './email.service';
import { TwoFactorService } from './two-factor.service';
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
import { User, Organization, Role, OrganizationMember } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: Role;
  permissions: string[];
  membershipId: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: Omit<User, 'password' | 'twoFactorSecret'>;
  accessToken: string;
  refreshToken: string;
  organization: Organization;
  availableOrganizations?: OrganizationSummary[];
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  permissions: string[];
}

export interface SwitchOrganizationDto {
  organizationId: string;
}

export interface InviteUserDto {
  email: string;
  role: Role;
  permissions?: string[];
}

@Injectable()
export class EnhancedAuthService {
  private readonly logger = new Logger(EnhancedAuthService.name);
  private readonly saltRounds = 12;
  private readonly refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, password, firstName, lastName, organizationName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Generate email verification token
    const emailVerificationToken = this.generateSecureToken();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      // Create user and organization in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create organization
        const organization = await tx.organization.create({
          data: {
            name: organizationName,
            slug: this.generateSlug(organizationName),
            settings: {
              allowRegistration: true,
              requireEmailVerification: true,
              enable2FA: false,
            },
          },
        });

        // Create user
        const user = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName,
            emailVerificationToken,
            emailVerificationExpires,
          },
        });

        // Create organization membership with ORG_ADMIN role for the founder
        const membership = await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            role: Role.ORG_ADMIN,
            permissions: this.getUserPermissions(Role.ORG_ADMIN),
            isActive: true,
          },
        });

        return { user, organization, membership };
      });

      // Send verification email
      await this.emailService.sendVerificationEmail(
        result.user.email,
        result.user.firstName,
        emailVerificationToken,
      );

      this.logger.log(`User registered: ${result.user.email} for organization: ${result.organization.name}`);

      return { message: 'Registration successful. Please check your email to verify your account.' };
    } catch (error) {
      this.logger.error(`Registration failed for ${email}:`, error);
      throw new BadRequestException('Registration failed. Please try again.');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password, twoFactorCode } = loginDto;

    // Find user with organization memberships
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        organizationMemberships: {
          where: { isActive: true },
          include: { organization: true },
          orderBy: { joinedAt: 'asc' }, // Primary organization is the first one joined
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check email verification
    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    // Check if user has at least one active organization membership
    if (!user.organizationMemberships.length) {
      throw new ForbiddenException('User has no active organization memberships');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        throw new BadRequestException('Two-factor authentication code required');
      }

      const is2FAValid = await this.twoFactorService.verifyToken(
        user.twoFactorSecret,
        twoFactorCode,
      );

      if (!is2FAValid) {
        throw new UnauthorizedException('Invalid two-factor authentication code');
      }
    }

    // Get primary organization (first active membership)
    const primaryMembership = user.organizationMemberships[0];

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens with organization context
    const tokens = await this.generateTokens(user, primaryMembership);

    // Create available organizations summary
    const availableOrganizations: OrganizationSummary[] = user.organizationMemberships.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
      permissions: membership.permissions,
    }));

    this.logger.log(`User logged in: ${user.email} to organization: ${primaryMembership.organization.name}`);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      organization: primaryMembership.organization,
      availableOrganizations,
    };
  }

  async switchOrganization(userId: string, switchDto: SwitchOrganizationDto): Promise<AuthResponse> {
    const { organizationId } = switchDto;

    // Find the user's membership in the target organization
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        isActive: true,
      },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of the specified organization');
    }

    // Generate new tokens with the new organization context
    const tokens = await this.generateTokens(membership.user, membership);

    // Get all available organizations for this user
    const allMemberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: { organization: true },
    });

    const availableOrganizations: OrganizationSummary[] = allMemberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      permissions: m.permissions,
    }));

    this.logger.log(`User ${userId} switched to organization: ${membership.organization.name}`);

    return {
      user: this.sanitizeUser(membership.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      organization: membership.organization,
      availableOrganizations,
    };
  }

  async inviteUser(inviterUserId: string, organizationId: string, inviteDto: InviteUserDto): Promise<{ message: string }> {
    const { email, role, permissions } = inviteDto;

    // Verify inviter has permission to invite users
    const inviterMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: inviterUserId,
        organizationId,
        isActive: true,
        role: { in: [Role.ORG_ADMIN, Role.SUPER_ADMIN] },
      },
      include: { organization: true },
    });

    if (!inviterMembership) {
      throw new ForbiddenException('Insufficient permissions to invite users');
    }

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    let isNewUser = false;

    if (!user) {
      // Create new user with temporary password
      const tempPassword = this.generateSecureToken();
      const hashedPassword = await bcrypt.hash(tempPassword, this.saltRounds);
      const emailVerificationToken = this.generateSecureToken();

      user = await this.prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName: email.split('@')[0], // Temporary first name
          lastName: 'User', // Temporary last name
          emailVerificationToken,
          emailVerificationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      isNewUser = true;
    }

    // Check if user is already a member of this organization
    const existingMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organizationId,
      },
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        throw new ConflictException('User is already a member of this organization');
      } else {
        // Reactivate membership
        await this.prisma.organizationMember.update({
          where: { id: existingMembership.id },
          data: {
            role,
            permissions: permissions || this.getUserPermissions(role),
            isActive: true,
          },
        });
      }
    } else {
      // Create new membership
      await this.prisma.organizationMember.create({
        data: {
          organizationId,
          userId: user.id,
          role,
          permissions: permissions || this.getUserPermissions(role),
          isActive: true,
        },
      });
    }

    // Send invitation email
    if (isNewUser) {
      await this.emailService.sendInvitationEmail(
        user.email,
        inviterMembership.organization.name,
        user.emailVerificationToken,
      );
    } else {
      await this.emailService.sendOrganizationInvitationEmail(
        user.email,
        user.firstName,
        inviterMembership.organization.name,
      );
    }

    this.logger.log(`User invited: ${email} to organization: ${inviterMembership.organization.name} by ${inviterUserId}`);

    return { message: 'User invited successfully' };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string }> {
    const { refreshToken } = refreshTokenDto;

    // Get stored data from Redis
    const storedData = await this.redisService.get(`refresh_token:${refreshToken}`);
    if (!storedData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { userId, membershipId } = JSON.parse(storedData);

    // Get user and membership
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        id: membershipId,
        userId,
        isActive: true,
      },
      include: {
        user: true,
        organization: true,
      },
    });

    if (!membership || !membership.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new access token
    const payload: JwtPayload = {
      sub: membership.user.id,
      email: membership.user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      permissions: membership.permissions,
      membershipId: membership.id,
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async logout(userId: string, refreshToken?: string): Promise<{ message: string }> {
    // Remove specific refresh token if provided
    if (refreshToken) {
      await this.redisService.del(`refresh_token:${refreshToken}`);
    }

    // Remove all refresh tokens for user
    const pattern = `refresh_token:*`;
    const keys = await this.redisService.keys(pattern);

    for (const key of keys) {
      const storedData = await this.redisService.get(key);
      if (storedData) {
        const { userId: storedUserId } = JSON.parse(storedData);
        if (storedUserId === userId) {
          await this.redisService.del(key);
        }
      }
    }

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  // ... (Include other methods like forgotPassword, resetPassword, verifyEmail, etc. from original service)

  private async generateTokens(user: User, membership: OrganizationMember): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      permissions: membership.permissions,
      membershipId: membership.id,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateSecureToken();

    // Store refresh token in Redis with user and membership context
    await this.redisService.setex(
      `refresh_token:${refreshToken}`,
      this.refreshTokenTTL,
      JSON.stringify({
        userId: user.id,
        membershipId: membership.id,
      }),
    );

    return { accessToken, refreshToken };
  }

  private getUserPermissions(role: Role): string[] {
    const permissions = {
      [Role.SUPER_ADMIN]: [
        'system:read',
        'system:write',
        'organization:read',
        'organization:write',
        'user:read',
        'user:write',
        'user:invite',
        'agent:read',
        'agent:write',
        'tool:read',
        'tool:write',
        'workflow:read',
        'workflow:write',
        'provider:read',
        'provider:write',
        'analytics:read',
      ],
      [Role.ORG_ADMIN]: [
        'organization:read',
        'organization:write',
        'user:read',
        'user:write',
        'user:invite',
        'agent:read',
        'agent:write',
        'tool:read',
        'tool:write',
        'workflow:read',
        'workflow:write',
        'provider:read',
        'provider:write',
        'analytics:read',
      ],
      [Role.DEVELOPER]: [
        'agent:read',
        'agent:write',
        'tool:read',
        'tool:write',
        'workflow:read',
        'workflow:write',
        'provider:read',
        'analytics:read',
      ],
      [Role.VIEWER]: [
        'agent:read',
        'tool:read',
        'workflow:read',
        'provider:read',
        'analytics:read',
      ],
    };

    return permissions[role] || [];
  }

  private sanitizeUser(user: User): Omit<User, 'password' | 'twoFactorSecret'> {
    const { password, twoFactorSecret, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}