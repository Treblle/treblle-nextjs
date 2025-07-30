/**
 * @file tests/integration/nestjs.integration.test.ts
 * @description Integration tests for NestJS with real HTTP requests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Post, Body, Module } from '@nestjs/common';
import * as request from 'supertest';
import { TreblleModule, TreblleMiddleware, TreblleExceptionFilter } from '../../src/integrations/nestjs';

// Test DTO
class TestDto {
  name!: string;
  email!: string;
  password!: string;
}

// Test controller
@Controller('api')
class TestController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('users')
  createUser(@Body() userData: TestDto) {
    return {
      success: true,
      data: {
        id: 1,
        name: userData.name,
        email: userData.email
        // password should be masked by Treblle
      }
    };
  }

  @Get('error')
  throwError() {
    throw new Error('Integration test error');
  }

  @Get('async-error')
  async asyncError() {
    await new Promise(resolve => setTimeout(resolve, 10));
    throw new Error('Async integration test error');
  }
}

// Test module
@Module({
  imports: [
    TreblleModule.register({
      sdkToken: 'integration-test-sdk-token',
      apiKey: 'integration-test-api-key',
      additionalMaskedFields: ['password'],
      debug: true,
      environments: {
        disabled: [] // Enable for integration tests
      }
    })
  ],
  controllers: [TestController]
})
class TestAppModule {}

describe.skip('NestJS Integration Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestAppModule]
    }).compile();

    app = moduleRef.createNestApplication();

    // Get Treblle components from the module
    const treblleMiddleware = app.get(TreblleMiddleware);
    const treblleExceptionFilter = app.get(TreblleExceptionFilter);

    // Apply global components
    app.use(treblleMiddleware.use.bind(treblleMiddleware));
    app.useGlobalFilters(treblleExceptionFilter);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HTTP Requests', () => {
    test('should handle GET request successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });

    test('should handle POST request with body', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123'
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com'
        }
      });
    });

    test('should handle application errors', async () => {
      await request(app.getHttpServer())
        .get('/api/error')
        .expect(500);
    });

    test('should handle async errors', async () => {
      await request(app.getHttpServer())
        .get('/api/async-error')
        .expect(500);
    });

    test('should handle invalid JSON payload', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send('invalid-json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    test('should handle missing endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/nonexistent')
        .expect(404);
    });
  });

  describe('Treblle Integration', () => {
    test('should inject TreblleMiddleware', () => {
      const middleware = app.get(TreblleMiddleware);
      expect(middleware).toBeDefined();
      expect(typeof middleware.use).toBe('function');
    });

    test('should inject TreblleExceptionFilter', () => {
      const filter = app.get(TreblleExceptionFilter);
      expect(filter).toBeDefined();
      expect(typeof filter.catch).toBe('function');
    });

    test('should process requests with Treblle middleware', async () => {
      // This test verifies that requests go through the Treblle middleware
      // without causing any errors or blocking the response
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .set('User-Agent', 'Integration Test Agent')
        .set('X-Custom-Header', 'test-value')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });

    test('should handle large payloads', async () => {
      const largePayload = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'secret',
        data: 'x'.repeat(1000) // 1KB of data
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(largePayload)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should process errors through exception filter', async () => {
      // The error should be processed by TreblleExceptionFilter
      // but still return the error response to the client
      await request(app.getHttpServer())
        .get('/api/error')
        .expect(500);
    });

    test('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/health')
          .expect(200)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.body.status).toBe('ok');
      });
    });
  });
});
