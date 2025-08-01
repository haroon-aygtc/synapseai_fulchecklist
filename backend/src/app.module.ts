import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ToolsModule } from './modules/tools/tools.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { ApixModule } from './modules/apix/apix.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    ApixModule,
    AgentsModule,
    ToolsModule,
    WorkflowsModule,
  ],
})
export class AppModule {}