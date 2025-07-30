/**
 * @file tests/integrations/express.integration.test.ts
 * @description Comprehensive integration tests for Express framework
 */

import express from 'express';
import request from 'supertest';
import https from 'https';
import treblleExpress from '../../src/integrations/express';

// Mock https module
const mockRequest = {
  on: jest.fn().mockReturnThis(),
  setTimeout: jest.fn().mockReturnThis(),
  write: jest.fn().mockReturnThis(),
  end: jest.fn(),
  destroy: jest.fn()
};

jest.mock('https', () => ({
  request: jest.fn().mockImplementation(() => mockRequest)
}));

describe('Express Integration', () => {
  let app: express.Application;
  let server: any;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
    // Reset NODE_ENV using Object.defineProperty to bypass readonly
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      writable: true,
      configurable: true
    });
  });

  describe('Express Integration Functions', () => {
    const treblleOptions = {
      sdkToken: 'test-sdk-token',
      apiKey: 'test-api-key',
      debug: true
    };

    test('should create Treblle middleware', () => {
      const middleware = treblleExpress.createTreblleMiddleware(treblleOptions);
      expect(typeof middleware).toBe('function');
    });

    test('should create Treblle error handler', () => {
      const errorHandler = treblleExpress.createTreblleErrorHandler(treblleOptions);
      expect(typeof errorHandler).toBe('function');
    });

    test('should create error handler without options if middleware exists', () => {
      // Create middleware first
      treblleExpress.createTreblleMiddleware(treblleOptions);
      
      // Then create error handler without options
      const errorHandler = treblleExpress.createTreblleErrorHandler();
      expect(typeof errorHandler).toBe('function');
    });

    test('should throw error when creating error handler without instance', () => {
      // Clear any existing instances
      treblleExpress.clearInstances();
      
      expect(() => {
        treblleExpress.createTreblleErrorHandler();
      }).toThrow('No Treblle instance found');
    });

    test('should configure Treblle on app', () => {
      const mockApp = {
        use: jest.fn()
      };

      treblleExpress.configureTreblle(mockApp, treblleOptions);

      expect(mockApp.use).toHaveBeenCalledTimes(2); // middleware + error handler
    });

    test('should apply Treblle to routes', () => {
      const routeMiddleware = treblleExpress.applyTreblleToRoutes(treblleOptions);
      expect(typeof routeMiddleware).toBe('function');
    });
  });

  describe('TreblleMiddleware Class', () => {
    const treblleOptions = {
      sdkToken: 'test-sdk-token',
      apiKey: 'test-api-key',
      debug: true
    };

    test('should create TreblleMiddleware instance', () => {
      const middleware = new treblleExpress.TreblleMiddleware(treblleOptions);
      expect(middleware).toBeInstanceOf(treblleExpress.TreblleMiddleware);
    });

    test('should handle requests with use method', () => {
      const middleware = new treblleExpress.TreblleMiddleware(treblleOptions);
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();

      middleware.use(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle errors with handleError method', () => {
      const middleware = new treblleExpress.TreblleMiddleware(treblleOptions);
      const mockError = new Error('Test error');
      const mockReq = {};
      const mockRes = { _treblleErrors: [] };
      const mockNext = jest.fn();

      middleware.handleError(mockError, mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('End-to-End Express Integration', () => {
    const treblleOptions = {
      sdkToken: 'test-sdk-token',
      apiKey: 'test-api-key',
      debug: true
    };

    test('should capture GET request data', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.get('/api/users', (_req, res) => {
        res.json({ users: ['user1', 'user2'] });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body).toEqual({ users: ['user1', 'user2'] });
      
      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should capture POST request with body', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.post('/api/users', (req, res) => {
        res.status(201).json({ id: 1, ...req.body });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      const userData = { name: 'John Doe', password: 'secret123' };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body.name).toBe('John Doe');
      expect(response.body.id).toBe(1);
      
      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should handle errors and capture error details', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.get('/api/error', (_req, _res, next) => {
        const error = new Error('Test error');
        next(error);
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      // Default error handler
      app.use((_err: Error, _req: any, res: any, _next: any) => {
        res.status(500).json({ error: 'Internal Server Error' });
      });

      const response = await request(app)
        .get('/api/error')
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal Server Error' });
      
      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should exclude specified paths', async () => {
      const optionsWithExclusion = {
        ...treblleOptions,
        excludePaths: ['/health', '/metrics']
      };

      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(optionsWithExclusion));

      app.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
      });

      app.get('/api/users', (_req, res) => {
        res.json({ users: [] });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      // Health endpoint should not trigger telemetry
      await request(app)
        .get('/health')
        .expect(200);

      expect(https.request).not.toHaveBeenCalled();

      // Regular API endpoint should trigger telemetry
      await request(app)
        .get('/api/users')
        .expect(200);

      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should handle file uploads', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.post('/api/upload', (_req, res) => {
        // Simulate file upload processing without modifying request
        res.json({ message: 'File uploaded successfully' });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      const response = await request(app)
        .post('/api/upload')
        .attach('upload', Buffer.from('fake-image-data'), 'test.jpg')
        .expect(200);

      expect(response.body.message).toBe('File uploaded successfully');
      
      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should handle different response types', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.get('/api/json', (_req, res) => {
        res.json({ type: 'json' });
      });

      app.get('/api/text', (_req, res) => {
        res.send('Plain text response');
      });

      app.get('/api/html', (_req, res) => {
        res.set('Content-Type', 'text/html');
        res.send('<html><body>HTML Response</body></html>');
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      // Test JSON response
      await request(app)
        .get('/api/json')
        .expect(200);

      // Test text response
      await request(app)
        .get('/api/text')
        .expect(200);

      // Test HTML response
      await request(app)
        .get('/api/html')
        .expect(200);

      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 300));
      
      expect(https.request).toHaveBeenCalledTimes(3);
    });

    test('should respect environment settings', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'test',
        writable: true,
        configurable: true
      });

      const optionsWithDisabledEnv = {
        ...treblleOptions,
        environments: {
          disabled: ['test']
        }
      };

      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(optionsWithDisabledEnv));

      app.get('/api/users', (_req, res) => {
        res.json({ users: [] });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      await request(app)
        .get('/api/users')
        .expect(200);

      // Should not send telemetry in disabled environment
      expect(https.request).not.toHaveBeenCalled();
    });

    test('should handle middleware order correctly', async () => {
      // Test incorrect order (Treblle before body parser)
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));
      app.use(express.json()); // Body parser after Treblle

      app.post('/api/test', (req, res) => {
        res.json({ received: req.body });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      await request(app)
        .post('/api/test')
        .send({ test: 'data' })
        .expect(200);

      // Should still work but may not capture request body correctly
      expect(https.request).toHaveBeenCalled();
    });

    test('should handle query parameters', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.get('/api/search', (req, res) => {
        res.json({ 
          query: req.query.q,
          page: req.query.page || 1
        });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test query', page: 2 })
        .expect(200);

      expect(response.body.query).toBe('test query');
      expect(response.body.page).toBe('2');
      
      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should handle custom headers', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.get('/api/headers', (req, res) => {
        res.set('X-Custom-Header', 'custom-value');
        res.json({ headers: req.headers });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      const response = await request(app)
        .get('/api/headers')
        .set('X-Client-ID', 'client-123')
        .expect(200);

      expect(response.headers['x-custom-header']).toBe('custom-value');
      expect(response.body.headers['x-client-id']).toBe('client-123');
      
      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should handle route parameters', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.get('/api/users/:id/posts/:postId', (req, res) => {
        res.json({
          userId: req.params.id,
          postId: req.params.postId
        });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      const response = await request(app)
        .get('/api/users/123/posts/456')
        .expect(200);

      expect(response.body.userId).toBe('123');
      expect(response.body.postId).toBe('456');
      
      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(https.request).toHaveBeenCalled();
    });
  });

  describe('Performance and Load Testing', () => {
    const treblleOptions = {
      sdkToken: 'test-sdk-token',
      apiKey: 'test-api-key',
      debug: false // Disable debug for performance tests
    };

    test('should handle multiple concurrent requests', async () => {
      app.use(express.json());
      app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

      app.get('/api/test', (_req, res) => {
        res.json({ timestamp: Date.now() });
      });

      app.use(treblleExpress.createTreblleErrorHandler());

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/test')
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.body.timestamp).toBeDefined();
      });

      // Wait for async payload sending
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(https.request).toHaveBeenCalledTimes(10);
    });

    test('should not significantly impact response time', async () => {
      const appWithoutTreblle = express();
      appWithoutTreblle.use(express.json());
      appWithoutTreblle.get('/test', (_req, res) => {
        res.json({ message: 'test' });
      });

      const appWithTreblle = express();
      appWithTreblle.use(express.json());
      appWithTreblle.use(treblleExpress.createTreblleMiddleware(treblleOptions));
      appWithTreblle.get('/test', (_req, res) => {
        res.json({ message: 'test' });
      });
      appWithTreblle.use(treblleExpress.createTreblleErrorHandler());

      // Measure response time without Treblle
      const startWithout = Date.now();
      await request(appWithoutTreblle).get('/test').expect(200);
      const timeWithout = Date.now() - startWithout;

      // Measure response time with Treblle
      const startWith = Date.now();
      await request(appWithTreblle).get('/test').expect(200);
      const timeWith = Date.now() - startWith;

      // Treblle should add minimal overhead (less than 50ms)
      expect(timeWith - timeWithout).toBeLessThan(50);
    });
  });
});
