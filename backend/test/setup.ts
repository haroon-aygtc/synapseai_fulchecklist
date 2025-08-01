import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/synapseai_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
});

// Global test teardown
afterAll(async () => {
  // Clean up test data if needed
});

// Mock external services for testing
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      }
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  }))
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn(),
      screenshot: jest.fn().mockResolvedValue('base64screenshot'),
      evaluate: jest.fn(),
      close: jest.fn()
    }),
    close: jest.fn()
  })
}));

// Test utilities
export class TestUtils {
  static async createTestModule(moduleMetadata: any): Promise<TestingModule> {
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    return module;
  }

  static async cleanupDatabase(prisma: PrismaService) {
    // Clean up test data in reverse order of dependencies
    await prisma.toolExecution.deleteMany();
    await prisma.tool.deleteMany();
    await prisma.workflowExecution.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.agentSession.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.documentChunk.deleteMany();
    await prisma.document.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.knowledgeBase.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  }

  static generateTestUser() {
    return {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };
  }

  static generateTestOrganization() {
    return {
      name: `Test Org ${Date.now()}`,
      slug: `test-org-${Date.now()}`,
      settings: {}
    };
  }

  static generateTestTool() {
    return {
      name: `Test Tool ${Date.now()}`,
      description: 'A test tool',
      type: 'FUNCTION',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      code: 'function test(input) { return { result: "test" }; }',
      config: { timeout: 30000 }
    };
  }
}