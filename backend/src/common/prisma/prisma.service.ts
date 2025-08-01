import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
      log: configService.get('NODE_ENV') === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    
    // Apply middleware for multi-tenancy
    this.$use(async (params, next) => {
      // Skip middleware for auth-related operations
      const skipModels = ['User', 'Session', 'Organization'];
      if (skipModels.includes(params.model)) {
        return next(params);
      }

      // Get tenant context from async local storage
      const tenantId = global.tenantContext?.get('organizationId');
      
      if (tenantId && params.action !== 'findUnique' && params.action !== 'findFirst') {
        if (params.action === 'findMany' || params.action === 'count') {
          // Add where filter for read operations
          if (!params.args) {
            params.args = { where: { organizationId: tenantId } };
          } else if (!params.args.where) {
            params.args.where = { organizationId: tenantId };
          } else {
            params.args.where.organizationId = tenantId;
          }
        } else if (params.action === 'create' || params.action === 'createMany') {
          // Add organizationId for create operations
          if (params.args.data) {
            params.args.data.organizationId = tenantId;
          }
        } else if (params.action === 'update' || params.action === 'updateMany') {
          // Add where filter for update operations
          if (!params.args.where) {
            params.args.where = { organizationId: tenantId };
          } else {
            params.args.where.organizationId = tenantId;
          }
        } else if (params.action === 'delete' || params.action === 'deleteMany') {
          // Add where filter for delete operations
          if (!params.args.where) {
            params.args.where = { organizationId: tenantId };
          } else {
            params.args.where.organizationId = tenantId;
          }
        }
      }
      
      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}