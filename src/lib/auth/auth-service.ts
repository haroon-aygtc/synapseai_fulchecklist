import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { User, JWTPayload, UserRole, Permission, ROLE_PERMISSIONS } from './types';
import { sessionManager } from './session-manager';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-key');
const JWT_ISSUER = process.env.JWT_ISSUER || 'synapseai';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'synapseai-users';

export class AuthService {
  private static instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 24 * 60 * 60; // 24 hours

    return new SignJWT({
      ...payload,
      iat: now,
      exp: now + expiresIn
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(JWT_SECRET);
  }

  async verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      return payload as JWTPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  async generateRefreshToken(): Promise<string> {
    return crypto.randomBytes(64).toString('hex');
  }

  async generateApiKey(): Promise<string> {
    const prefix = 'sk_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomBytes}`;
  }

  // Two-Factor Authentication
  async generateTwoFactorSecret(userEmail: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: 'SynapseAI',
      length: 32
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    
    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    return {
      secret: secret.base32!,
      qrCodeUrl,
      backupCodes
    };
  }

  async verifyTwoFactorToken(secret: string, token: string): Promise<boolean> {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps of variance
    });
  }

  async verifyBackupCode(backupCodes: string[], code: string): Promise<{
    isValid: boolean;
    remainingCodes: string[];
  }> {
    const normalizedCode = code.toUpperCase().replace(/\s/g, '');
    const codeIndex = backupCodes.indexOf(normalizedCode);
    
    if (codeIndex === -1) {
      return { isValid: false, remainingCodes: backupCodes };
    }

    const remainingCodes = backupCodes.filter((_, index) => index !== codeIndex);
    return { isValid: true, remainingCodes };
  }

  // Permission Management
  getUserPermissions(role: UserRole, customPermissions: Permission[] = []): Permission[] {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    return [...new Set([...rolePermissions, ...customPermissions])];
  }

  hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
    return userPermissions.includes(requiredPermission) || 
           userPermissions.includes(Permission.SYSTEM_ADMIN);
  }

  hasAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.some(permission => 
      this.hasPermission(userPermissions, permission)
    );
  }

  hasAllPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.every(permission => 
      this.hasPermission(userPermissions, permission)
    );
  }

  // Session Management
  async createUserSession(user: User, ipAddress: string, userAgent: string): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }> {
    const sessionId = crypto.randomUUID();
    const refreshToken = await this.generateRefreshToken();
    
    const permissions = this.getUserPermissions(user.role, user.permissions);
    
    const accessToken = await this.generateJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions,
      sessionId
    });

    const session = {
      id: sessionId,
      userId: user.id,
      organizationId: user.organizationId,
      token: accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ipAddress,
      userAgent,
      isActive: true,
      lastActivityAt: new Date(),
      createdAt: new Date()
    };

    await sessionManager.createSession(session);

    return {
      accessToken,
      refreshToken,
      sessionId
    };
  }

  async refreshUserSession(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> {
    // In a real implementation, you would validate the refresh token against the database
    // For now, we'll implement a basic version
    try {
      // Decode the refresh token to get session info
      // This is a simplified implementation
      const sessionId = crypto.createHash('sha256').update(refreshToken).digest('hex').substring(0, 16);
      const session = await sessionManager.getSession(sessionId);
      
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return null;
      }

      // Generate new tokens
      const newRefreshToken = await this.generateRefreshToken();
      const newAccessToken = await this.generateJWT({
        sub: session.userId,
        email: '', // Would be fetched from database
        role: UserRole.DEVELOPER, // Would be fetched from database
        organizationId: session.organizationId,
        permissions: [], // Would be fetched from database
        sessionId: session.id
      });

      // Update session
      session.token = newAccessToken;
      session.refreshToken = newRefreshToken;
      session.lastActivityAt = new Date();
      
      await sessionManager.createSession(session);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  }

  async validateSession(token: string): Promise<{
    isValid: boolean;
    payload?: JWTPayload;
    session?: any;
  }> {
    const payload = await this.verifyJWT(token);
    
    if (!payload) {
      return { isValid: false };
    }

    const session = await sessionManager.getSession(payload.sessionId);
    
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return { isValid: false };
    }

    // Update last activity
    await sessionManager.updateSessionActivity(payload.sessionId);

    return {
      isValid: true,
      payload,
      session
    };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await sessionManager.invalidateSession(sessionId);
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    await sessionManager.invalidateUserSessions(userId);
  }

  // Rate limiting helpers
  generateRateLimitKey(identifier: string, action: string): string {
    return `rate_limit:${action}:${identifier}`;
  }

  // Security utilities
  async generateSecureToken(length: number = 32): Promise<string> {
    return crypto.randomBytes(length).toString('hex');
  }

  async hashApiKey(apiKey: string): Promise<string> {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // IP validation for whitelisting
  isIpWhitelisted(ip: string, whitelist: string[]): boolean {
    if (whitelist.length === 0) return true;
    
    return whitelist.some(whitelistedIp => {
      if (whitelistedIp.includes('/')) {
        // CIDR notation support would go here
        return false;
      }
      return ip === whitelistedIp;
    });
  }

  // Audit logging
  async logSecurityEvent(event: {
    userId?: string;
    organizationId?: string;
    action: string;
    resource: string;
    details: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    success: boolean;
  }): Promise<void> {
    // In a real implementation, this would write to an audit log
    console.log('Security Event:', {
      ...event,
      timestamp: new Date().toISOString()
    });
  }
}

export const authService = AuthService.getInstance();