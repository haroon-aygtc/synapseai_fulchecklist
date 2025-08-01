import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { TestUtils } from '../../../test/setup';

describe('ToolsService', () => {
  let service: ToolsService;
  let prisma: PrismaService;
  let redis: RedisService;
  let apix: ApixService;

  const mockPrismaService = {
    tool: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    toolExecution: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  };

  const mockApixService = {
    emitToRoom: jest.fn(),
    emitToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ApixService, useValue: mockApixService },
      ],
    }).compile();

    service = module.get<ToolsService>(ToolsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    apix = module.get<ApixService>(ApixService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tools for an organization', async () => {
      const mockTools = [
        {
          id: '1',
          name: 'Test Tool',
          description: 'A test tool',
          type: 'FUNCTION',
          organizationId: 'org1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.tool.findMany.mockResolvedValue(mockTools);

      const result = await service.findAll('org1', {});

      expect(prisma.tool.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockTools);
    });

    it('should apply search filters', async () => {
      const query = {
        search: 'test',
        type: 'FUNCTION' as any,
        status: 'ACTIVE' as any,
        category: 'Data Processing',
      };

      mockPrismaService.tool.findMany.mockResolvedValue([]);

      await service.findAll('org1', query);

      expect(prisma.tool.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          AND: [
            {
              OR: [
                { name: { contains: 'test', mode: 'insensitive' } },
                { description: { contains: 'test', mode: 'insensitive' } },
              ],
            },
            { type: 'FUNCTION' },
            { status: 'ACTIVE' },
            { category: 'Data Processing' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('create', () => {
    it('should create a new tool', async () => {
      const toolData = TestUtils.generateTestTool();
      const mockCreatedTool = {
        id: '1',
        ...toolData,
        organizationId: 'org1',
        authorId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.tool.create.mockResolvedValue(mockCreatedTool);

      const result = await service.create('org1', 'user1', toolData);

      expect(prisma.tool.create).toHaveBeenCalledWith({
        data: {
          ...toolData,
          organizationId: 'org1',
          authorId: 'user1',
          status: 'DRAFT',
          version: '1.0.0',
        },
      });
      expect(result).toEqual(mockCreatedTool);
    });

    it('should validate tool data', async () => {
      const invalidToolData = {
        name: '', // Invalid: empty name
        type: 'INVALID_TYPE' as any,
      };

      await expect(service.create('org1', 'user1', invalidToolData)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('executeTool', () => {
    it('should execute a function tool successfully', async () => {
      const mockTool = {
        id: '1',
        name: 'Test Tool',
        type: 'FUNCTION',
        code: 'function test(input) { return { result: input.value * 2 }; }',
        config: { timeout: 30000 },
        organizationId: 'org1',
      };

      const mockExecution = {
        id: 'exec1',
        toolId: '1',
        status: 'PENDING',
        input: { value: 5 },
        createdAt: new Date(),
      };

      mockPrismaService.tool.findFirst.mockResolvedValue(mockTool);
      mockPrismaService.toolExecution.create.mockResolvedValue(mockExecution);
      mockPrismaService.toolExecution.update.mockResolvedValue({
        ...mockExecution,
        status: 'COMPLETED',
        output: { result: 10 },
      });

      const result = await service.executeTool('1', 'org1', 'user1', {
        input: { value: 5 },
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.output).toEqual({ result: 10 });
    });

    it('should handle tool execution errors', async () => {
      const mockTool = {
        id: '1',
        name: 'Test Tool',
        type: 'FUNCTION',
        code: 'function test(input) { throw new Error("Test error"); }',
        config: { timeout: 30000 },
        organizationId: 'org1',
      };

      mockPrismaService.tool.findFirst.mockResolvedValue(mockTool);
      mockPrismaService.toolExecution.create.mockResolvedValue({
        id: 'exec1',
        status: 'PENDING',
      });

      const result = await service.executeTool('1', 'org1', 'user1', {
        input: { value: 5 },
      });

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Test error');
    });

    it('should throw NotFoundException for non-existent tool', async () => {
      mockPrismaService.tool.findFirst.mockResolvedValue(null);

      await expect(
        service.executeTool('nonexistent', 'org1', 'user1', { input: {} })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance metrics correctly', async () => {
      const mockTool = {
        id: '1',
        name: 'Test Tool',
        status: 'ACTIVE',
      };

      const mockExecutions = [
        { status: 'COMPLETED', duration: 1000, createdAt: new Date() },
        { status: 'COMPLETED', duration: 2000, createdAt: new Date() },
        { status: 'FAILED', duration: 500, createdAt: new Date() },
      ];

      mockPrismaService.tool.findFirst.mockResolvedValue(mockTool);
      mockPrismaService.toolExecution.findMany.mockResolvedValue(mockExecutions);

      const result = await service.getPerformanceMetrics('1', 'org1');

      expect(result.performance.successRate).toBe(66.67); // 2/3 * 100
      expect(result.performance.errorRate).toBe(33.33); // 1/3 * 100
      expect(result.performance.avgResponseTime).toBe(1.17); // 1167ms / 1000
      expect(result.usage.total).toBe(3);
    });
  });

  describe('getTemplates', () => {
    it('should return predefined tool templates', async () => {
      const result = await service.getTemplates('org1');

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('name', 'API Caller');
      expect(result[1]).toHaveProperty('name', 'Data Processor');
      expect(result[2]).toHaveProperty('name', 'Web Scraper');
    });
  });
});