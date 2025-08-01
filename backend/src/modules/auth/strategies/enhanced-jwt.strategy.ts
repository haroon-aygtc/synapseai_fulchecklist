import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { JwtPayload } from '../enhanced-auth.service';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
  permissions: string[];
  membershipId: string;
  user: any;
  organization: any;
  membership: any;
}

@Injectable()
export class EnhancedJwtStrategy extends PassportStrategy(Strategy, 'enhanced-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    // Validate the membership still exists and is active
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        id: payload.membershipId,
        userId: payload.sub,
        organizationId: payload.organizationId,
        isActive: true,
      },
      include: {
        user: true,
        organization: true,
      },
    });

    if (!membership || !membership.user.isActive) {
      return null;
    }

    // Verify the JWT payload matches the current membership state
    if (
      membership.role !== payload.role ||
      membership.organizationId !== payload.organizationId ||
      membership.user.email !== payload.email
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      role: payload.role,
      permissions: membership.permissions, // Use current permissions from DB
      membershipId: payload.membershipId,
      user: membership.user,
      organization: membership.organization,
      membership,
    };
  }
}