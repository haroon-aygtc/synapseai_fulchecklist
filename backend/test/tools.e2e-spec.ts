import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TestUtils } from './setup';

describe('Tools API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // Setup test data
    await TestUtils.cleanupDatabase(prisma);
    
    // Create test organization and user
    const org = await prisma.organization.create({
      data: TestUtils.generateTestOrganization(),
    });
    organizationId = org.id;

    const user = await prisma.user.create({
      data: TestUtils.generateTestUser(),
    });
    userId = user.id;

    // Create organization membership
    await prisma.organizationMember.create({
      data: {
        userId,
        organizationId,
        role: 'ADMIN',
        permissions: ['tool:read', 'tool:write', 'tool:execute', 'tool:delete'],
      },
    });

    // Get auth token (mock for testing)
    authToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    await TestUtils.cleanupDatabase(prisma);
    await app.close();
  });

  describe('/tools (GET)', () => {
    it('should return empty array when no tools exist', () => {
      return request(app.getHttpServer())
        .get('/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200)
        .expect((res) => {
          expect(res.body.tools).toEqual([]);
        });
    });

    it('should return tools for the organization', async () => {
      // Create a test tool
      const tool = await prisma.tool.create({
        data: {
          ...TestUtils.generateTestTool(),
          organizationId,
          authorId: userId,
        },
      });

      return request(app.getHttpServer())
        .get('/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200)
        .expect((res) => {
          expect(res.body.tools).toHaveLength(1);
          expect(res.body.tools[0].id).toBe(tool.id);
        });
    });

    it('should filter tools by search query', async () => {
      return request(app.getHttpServer())
        .get('/tools?search=test')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200);
    });

    it('should filter tools by type', async () => {
      return request(app.getHttpServer())
        .get('/tools?type=FUNCTION')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200);
    });
  });

  describe('/tools (POST)', () => {
    it('should create a new tool', () => {
      const toolData = TestUtils.generateTestTool();

      return request(app.getHttpServer())
        .post('/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send(toolData)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe(toolData.name);
          expect(res.body.type).toBe(toolData.type);
          expect(res.body.organizationId).toBe(organizationId);
        });
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          // Missing required fields
          description: 'Test tool without name',
        })
        .expect(400);
    });

    it('should validate tool type', () => {
      return request(app.getHttpServer())
        .post('/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          name: 'Test Tool',
          type: 'INVALID_TYPE',
        })
        .expect(400);
    });
  });

  describe('/tools/:id (GET)', () => {
    let toolId: string;

    beforeEach(async () => {
      const tool = await prisma.tool.create({
        data: {
          ...TestUtils.generateTestTool(),
          organizationId,
          authorId: userId,
        },
      });
      toolId = tool.id;
    });

    it('should return a specific tool', () => {
      return request(app.getHttpServer())
        .get(`/tools/${toolId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(toolId);
        });
    });

    it('should return 404 for non-existent tool', () => {
      return request(app.getHttpServer())
        .get('/tools/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(404);
    });
  });

  describe('/tools/:id (PUT)', () => {
    let toolId: string;

    beforeEach(async () => {
      const tool = await prisma.tool.create({
        data: {
          ...TestUtils.generateTestTool(),
          organizationId,
          authorId: userId,
        },
      });
      toolId = tool.id;
    });

    it('should update a tool', () => {
      const updateData = {
        name: 'Updated Tool Name',
        description: 'Updated description',
      };

      return request(app.getHttpServer())
        .put(`/tools/${toolId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe(updateData.name);
          expect(res.body.description).toBe(updateData.description);
        });
    });
  });

  describe('/tools/:id (DELETE)', () => {
    let toolId: string;

    beforeEach(async () => {
      const tool = await prisma.tool.create({
        data: {
          ...TestUtils.generateTestTool(),
          organizationId,
          authorId: userId,
        },
      });
      toolId = tool.id;
    });

    it('should delete a tool', () => {
      return request(app.getHttpServer())
        .delete(`/tools/${toolId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Tool deleted successfully');
        });
    });
  });

  describe('/tools/:id/execute (POST)', () => {
    let toolId: string;

    beforeEach(async () => {
      const tool = await prisma.tool.create({
        data: {
          ...TestUtils.generateTestTool(),
          organizationId,
          authorId: userId,
          code: 'function test(input) { return { result: input.value * 2 }; }',
        },
      });
      toolId = tool.id;
    });

    it('should execute a tool', () => {
      return request(app.getHttpServer())
        .post(`/tools/${toolId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          input: { value: 5 },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBeDefined();
          expect(res.body.input).toEqual({ value: 5 });
        });
    });

    it('should validate execution input', () => {
      return request(app.getHttpServer())
        .post(`/tools/${toolId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .send({
          // Missing input field
        })
        .expect(400);
    });
  });

  describe('/tools/templates (GET)', () => {
    it('should return tool templates', () => {
      return request(app.getHttpServer())
        .get('/tools/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-Id', organizationId)
        .expect(200)
        .expect((res) => {
          expect(res.body.templates).toHaveLength(3);
          expect(res.body.templates[0]).toHaveProperty('name');
          expect(res.body.templates[0]).toHaveProperty('template');
        });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/tools')
        .expect(401);
    });

    it('should require organization context', () => {
      return request(app.getHttpServer())
        .get('/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400); // Missing X-Organization-Id header
    });

    it('should check permissions', () => {
      // This would test permission-based access control
      // Implementation depends on your permission system
    });
  });
});