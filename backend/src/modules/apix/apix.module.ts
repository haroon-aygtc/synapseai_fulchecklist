import { Module } from '@nestjs/common';
import { ApixGateway } from './apix.gateway';
import { ApixService } from './apix.service';
import { ApixController } from './apix.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [ApixGateway, ApixService],
  controllers: [ApixController],
  exports: [ApixService],
})
export class ApixModule {}