import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Services
import { EnhancedAuthService } from './enhanced-auth.service';
import { EmailService } from './email.service';
import { TwoFactorService } from './two-factor.service';

// Controllers
import { EnhancedAuthController } from './enhanced-auth.controller';

// Strategies
import { EnhancedJwtStrategy } from './strategies/enhanced-jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

// Guards
import { EnhancedPermissionGuard } from '../../common/guards/enhanced-permission.guard';

// Middleware
import { MultiTenantMiddleware } from '../../common/middleware/multi-tenant.middleware';

// Modules
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    PassportModule.register({ defaultStrategy: 'enhanced-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: 1000,
          limit: 3,
        },
        {
          name: 'medium',
          ttl: 10000,
          limit: 20,
        },
        {
          name: 'long',
          ttl: 60000,
          limit: 100,
        },
      ],
      inject: [ConfigService],
    }),
  ],
  controllers: [EnhancedAuthController],
  providers: [
    EnhancedAuthService,
    EmailService,
    TwoFactorService,
    EnhancedJwtStrategy,
    LocalStrategy,
    EnhancedPermissionGuard,
  ],
  exports: [
    EnhancedAuthService, 
    JwtModule, 
    EnhancedJwtStrategy,
    EnhancedPermissionGuard,
  ],
})
export class EnhancedAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MultiTenantMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}