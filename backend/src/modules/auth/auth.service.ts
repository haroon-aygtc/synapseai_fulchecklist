import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
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
import { User, Organization, Role } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: Role;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: Omit<User, 'password' | 'twoFactorSecret'>;
  accessToken: string;
  refreshToken: string;
  organization: Organization;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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
            role: Role.ORG_ADMIN, // First user becomes org admin
            organizationId: organization.id,
            emailVerificationToken,
            emailVerificationExpires,
            isEmailVerified: false,
            isActive: true,
          },
        });

        return { user, organization };
      });

      // Send verification email
      await this.emailService.sendVerificationEmail(
        result.user.email,
        result.user.firstName,
        emailVerificationToken,
      );

      this.logger.log(`User registered: ${result.user.email}`);

      return {
        message: 'Registration successful. Please check your email to verify your account.',
      };
    } catch (error) {
      this.logger.error(`Registration failed for ${email}:`, error);
      throw new BadRequestException('Registration failed. Please try again.');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password, twoFactorCode } = loginDto;

    // Find user with organization
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
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

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      organization: user.organization,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string }> {
    const { refreshToken } = refreshTokenDto;

    // Get user ID from Redis
    const userId = await this.redisService.get(`refresh_token:${refreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new access token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      permissions: this.getUserPermissions(user.role),
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async logout(userId: string, refreshToken?: string): Promise<{ message: string }> {
    // Remove refresh token from Redis if provided
    if (refreshToken) {
      await this.redisService.del(`refresh_token:${refreshToken}`);
    }

    // Remove all refresh tokens for user
    const pattern = `refresh_token:*`;
    const keys = await this.redisService.keys(pattern);
    
    for (const key of keys) {
      const storedUserId = await this.redisService.get(key);
      if (storedUserId === userId) {
        await this.redisService.del(key);
      }
    }

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    // Generate reset token
    const resetToken = this.generateSecureToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send reset email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      resetToken,
    );

    this.logger.log(`Password reset requested for: ${user.email}`);

    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, password } = resetPasswordDto;

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all refresh tokens
    await this.logout(user.id);

    this.logger.log(`Password reset completed for: ${user.email}`);

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const { token } = verifyEmailDto;

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    this.logger.log(`Email verified for: ${user.email}`);

    return { message: 'Email verified successfully' };
  }

  async enable2FA(userId: string, enable2FADto: Enable2FADto): Promise<{ qrCode: string; backupCodes: string[] }> {
    const { password } = enable2FADto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Generate 2FA secret and QR code
    const { secret, qrCode } = await this.twoFactorService.generateSecret(
      user.email,
      'SynapseAI',
    );

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, this.saltRounds))
    );

    // Store secret and backup codes (not enabled yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        backupCodes: hashedBackupCodes,
      },
    });

    return { qrCode, backupCodes };
  }

  async verify2FA(userId: string, verify2FADto: Verify2FADto): Promise<{ message: string }> {
    const { token } = verify2FADto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA not set up');
    }

    // Verify token
    const isValid = await this.twoFactorService.verifyToken(user.twoFactorSecret, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    this.logger.log(`2FA enabled for user: ${user.email}`);

    return { message: '2FA enabled successfully' };
  }

  async disable2FA(userId: string, password: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Disable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      },
    });

    this.logger.log(`2FA disabled for user: ${user.email}`);

    return { message: '2FA disabled successfully' };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }

    return null;
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      permissions: this.getUserPermissions(user.role),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateSecureToken();

    // Store refresh token in Redis
    await this.redisService.setex(
      `refresh_token:${refreshToken}`,
      this.refreshTokenTTL,
      user.id,
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

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
}