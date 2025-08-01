import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ProviderAuthenticationService } from './provider-authentication.service';
import { SmartRoutingService } from './smart-routing.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { ApixModule } from '../apix/apix.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ApixModule,
    EventEmitterModule,
    ConfigModule,
  ],
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    ProviderAuthenticationService,
    SmartRoutingService,
  ],
  exports: [
    ProvidersService,
    ProviderAuthenticationService,
    SmartRoutingService,
  ],
})
export class ProvidersModule {}