/**
 * @file tests/integrations/nextjs.test.ts
 * @description Tests for Next.js integration
 */

import { 
  withTreblle, 
  createTreblleWrapper, 
  treblleHandler,
  NextRouteHandler 
} from '../../src/integrations/nextjs';
import { TreblleOptions } from '../../src/types';

// Mock the core Treblle SDK
jest.mock('../../src/core/instance-manager', () => ({
  getTreblleInstance: jest.fn(() => ({
    options: { enabled: true },
    shouldExcludePath: jest.fn(() => false),
    isPathIncluded: jest.fn(() => true),
    formatError: jest.fn((err) => ({ 
      message: err.message, 
      file: 'route.ts', 
      line: 1 
    })),
    capture: jest.fn()
  }))
}));

// Mock utils
jest.mock('../../src/utils', () => ({
  hrToMicro: jest.fn(() => 1234),
  getNextClientIp: jest.fn(() => '127.0.0.1'),
  getNextRoutePath: jest.fn(() => '/api/test')
}));

// Mock body parsers
jest.mock('../../src/core/body-parsers', () => ({
  parseNextjsRequestBody: jest.fn(async () => ({ test: 'request' })),
  parseNextjsResponseBody: jest.fn(async () => ({ test: 'response' }))
}));

// Mock payload builder
jest.mock('../../src/core/payload', () => ({
  buildTrebllePayload: jest.fn(() => ({ 
    api_key: 'test-key',
    data: {}
  }))
}));

describe('Next.js Integration', () => {
  const treblleOptions: TreblleOptions = {
    sdkToken: 'test-sdk-token',
    apiKey: 'test-api-key',
    debug: true
  };

  // Mock process.hrtime for Node.js runtime
  const originalProcess = global.process;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process.hrtime
    global.process = {
      ...originalProcess,
      hrtime: jest.fn(() => [0, 1000000]) // 1ms
    } as any;
  });

  afterAll(() => {
    global.process = originalProcess;
  });

  describe('withTreblle', () => {
    test('should create wrapper function', () => {
      const wrapper = withTreblle(treblleOptions);
      expect(typeof wrapper).toBe('function');
    });

    test('should wrap route handler correctly', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const originalHandler: NextRouteHandler = async (_request: Request) => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      };

      const wrappedHandler = wrapper(originalHandler);
      expect(typeof wrappedHandler).toBe('function');

      // Create mock request
      const request = new Request('http://localhost:3000/api/test', {
        method: 'GET',
        headers: { 'user-agent': 'test-agent' }
      });

      const context = { params: {} };
      const response = await wrappedHandler(request, context);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    test('should handle POST requests with body', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const originalHandler: NextRouteHandler = async (request: Request) => {
        const body = await request.json();
        return new Response(JSON.stringify({ received: body }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        });
      };

      const wrappedHandler = wrapper(originalHandler);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'john@example.com' })
      });

      const context = { params: {} };
      const response = await wrappedHandler(request, context);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(201);
    });

    test('should handle errors thrown by handler', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const originalHandler: NextRouteHandler = async () => {
        throw new Error('Handler error');
      };

      const wrappedHandler = wrapper(originalHandler);

      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };

      await expect(wrappedHandler(request, context)).rejects.toThrow('Handler error');
    });

    test('should skip when SDK is disabled', async () => {
      const disabledOptions = { ...treblleOptions, enabled: false };
      const wrapper = withTreblle(disabledOptions);
      
      const originalHandler = jest.fn(async (_req: Request, _ctx: { params?: any }) => new Response('OK'));
      const wrappedHandler = wrapper(originalHandler);

      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };
      
      await wrappedHandler(request, context);
      expect(originalHandler).toHaveBeenCalled();
    });

    test('should skip excluded paths', async () => {
      const optionsWithExclusion = {
        ...treblleOptions,
        excludePaths: ['/health']
      };
      
      // Mock the instance manager to return an instance that excludes paths
      const { getTreblleInstance } = require('../../src/core/instance-manager');
      getTreblleInstance.mockReturnValue({
        options: { enabled: true },
        shouldExcludePath: jest.fn((path) => path === '/health'),
        isPathIncluded: jest.fn(() => true),
        formatError: jest.fn(),
        capture: jest.fn()
      });

      const wrapper = withTreblle(optionsWithExclusion);
      const originalHandler = jest.fn(async (_req: Request, _ctx: { params?: any }) => new Response('OK'));
      const wrappedHandler = wrapper(originalHandler);

      const request = new Request('http://localhost:3000/health');
      const context = { params: {} };
      
      await wrappedHandler(request, context);
      expect(originalHandler).toHaveBeenCalled();
    });

    test('should handle Edge runtime gracefully', async () => {
      // Mock Edge runtime (no process.hrtime)
      const originalHrtime = global.process.hrtime;
      delete (global.process as any).hrtime;

      const wrapper = withTreblle(treblleOptions);
      const originalHandler = jest.fn(async (_req: Request, _ctx: { params?: any }) => new Response('OK'));
      const wrappedHandler = wrapper(originalHandler);

      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };
      
      await wrappedHandler(request, context);
      expect(originalHandler).toHaveBeenCalled();

      // Restore hrtime
      global.process.hrtime = originalHrtime;
    });
  });

  describe('createTreblleWrapper', () => {
    test('should create reusable wrapper', () => {
      const wrapper = createTreblleWrapper(treblleOptions);
      expect(typeof wrapper).toBe('object');
      expect(typeof wrapper.handler).toBe('function');
      expect(typeof wrapper.pagesHandler).toBe('function');
      expect(typeof wrapper.middleware).toBe('function');
    });

    test('should have different signature than withTreblle', () => {
      const wrapper1 = withTreblle(treblleOptions);
      const wrapper2 = createTreblleWrapper(treblleOptions);
      
      expect(typeof wrapper1).toBe('function');
      expect(typeof wrapper2).toBe('object');
    });
  });

  describe('treblleHandler', () => {
    test('should directly wrap handler with options', async () => {
      const originalHandler: NextRouteHandler = async () => {
        return new Response(JSON.stringify({ message: 'Hello' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      };

      const wrappedHandler = treblleHandler(originalHandler, treblleOptions);
      
      const request = new Request('http://localhost:3000/api/hello');
      const context = { params: {} };
      const response = await wrappedHandler(request, context);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    test('should handle dynamic routes with params', async () => {
      const originalHandler: NextRouteHandler<{ id: string }> = async (_request, context) => {
        const { id } = context.params || {};
        return new Response(JSON.stringify({ id }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      };

      const wrappedHandler = treblleHandler(originalHandler, treblleOptions);
      
      const request = new Request('http://localhost:3000/api/users/123');
      const context = { params: { id: '123' } };
      const response = await wrappedHandler(request, context);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });
  });

  describe('Request/Response Handling', () => {
    test('should handle different HTTP methods', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of methods) {
        const handler: NextRouteHandler = async () => {
          return new Response(`${method} response`, { status: 200 });
        };

        const wrappedHandler = wrapper(handler);
        const request = new Request('http://localhost:3000/api/test', { method });
        const context = { params: {} };
        
        const response = await wrappedHandler(request, context);
        expect(response.status).toBe(200);
      }
    });

    test('should handle different response status codes', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const statusCodes = [200, 201, 400, 404, 500];
      
      for (const status of statusCodes) {
        const handler: NextRouteHandler = async () => {
          return new Response('Response', { status });
        };

        const wrappedHandler = wrapper(handler);
        const request = new Request('http://localhost:3000/api/test');
        const context = { params: {} };
        
        const response = await wrappedHandler(request, context);
        expect(response.status).toBe(status);
      }
    });

    test('should handle various content types', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const contentTypes = [
        'application/json',
        'text/plain',
        'text/html',
        'application/xml'
      ];
      
      for (const contentType of contentTypes) {
        const handler: NextRouteHandler = async () => {
          return new Response('Content', {
            status: 200,
            headers: { 'content-type': contentType }
          });
        };

        const wrappedHandler = wrapper(handler);
        const request = new Request('http://localhost:3000/api/test');
        const context = { params: {} };
        
        const response = await wrappedHandler(request, context);
        expect(response.headers.get('content-type')).toBe(contentType);
      }
    });

    test('should handle request headers correctly', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async (request) => {
        const userAgent = request.headers.get('user-agent');
        return new Response(JSON.stringify({ userAgent }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      };

      const wrappedHandler = wrapper(handler);
      
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'user-agent': 'Next.js Test Client',
          'authorization': 'Bearer token123'
        }
      });
      
      const context = { params: {} };
      const response = await wrappedHandler(request, context);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('should capture and re-throw errors', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => {
        throw new Error('Custom error');
      };

      const wrappedHandler = wrapper(handler);
      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };

      await expect(wrappedHandler(request, context)).rejects.toThrow('Custom error');
    });

    test('should handle async errors', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async error');
      };

      const wrappedHandler = wrapper(handler);
      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };

      await expect(wrappedHandler(request, context)).rejects.toThrow('Async error');
    });

    test('should handle body parsing errors gracefully', async () => {
      // Mock body parser to throw error
      const { parseNextjsRequestBody } = require('../../src/core/body-parsers');
      parseNextjsRequestBody.mockRejectedValueOnce(new Error('Body parse error'));

      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => {
        return new Response('OK', { status: 200 });
      };

      const wrappedHandler = wrapper(handler);
      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        body: 'invalid json'
      });
      const context = { params: {} };
      
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
    });
  });

  describe('Performance and Timing', () => {
    test('should measure request duration', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        return new Response('OK', { status: 200 });
      };

      const wrappedHandler = wrapper(handler);
      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };
      
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
      
      // hrToMicro should have been called
      const { hrToMicro } = require('../../src/utils');
      expect(hrToMicro).toHaveBeenCalled();
    });
  });

  describe('Configuration Options', () => {
    test('should respect debug option', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugOptions = { ...treblleOptions, debug: true };
      const wrapper = withTreblle(debugOptions);
      
      const handler: NextRouteHandler = async () => new Response('OK');
      const wrappedHandler = wrapper(handler);

      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };
      
      await wrappedHandler(request, context);
      
      consoleSpy.mockRestore();
    });

    test('should handle includePaths option', async () => {
      const optionsWithInclusion = {
        ...treblleOptions,
        includePaths: ['/api/*']
      };
      
      // Mock the instance to check include paths
      const { getTreblleInstance } = require('../../src/core/instance-manager');
      getTreblleInstance.mockReturnValue({
        options: { enabled: true },
        shouldExcludePath: jest.fn(() => false),
        isPathIncluded: jest.fn((path) => path.startsWith('/api/')),
        formatError: jest.fn(),
        capture: jest.fn()
      });

      const wrapper = withTreblle(optionsWithInclusion);
      const handler = jest.fn(async (_req: Request, _ctx: { params?: any }) => new Response('OK'));
      const wrappedHandler = wrapper(handler);

      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };
      
      await wrappedHandler(request, context);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Pages Router Integration', () => {
    test('should handle pages router middleware', async () => {
      const wrapper = createTreblleWrapper(treblleOptions);
      
      // Test that middleware exists and is a function
      expect(typeof wrapper.middleware).toBe('function');
      
      // The middleware function should exist but may not be directly testable
      // without proper Express/Next.js context
    });

    test('should handle pages router handler', async () => {
      const wrapper = createTreblleWrapper(treblleOptions);
      
      const originalHandler = jest.fn(async (_req, res) => {
        res.status(200).json({ success: true });
      });
      
      const wrappedHandler = wrapper.pagesHandler(originalHandler);
      
      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: {},
        body: null
      };
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        statusCode: 200,
        getHeaders: () => ({})
      };
      
      await wrappedHandler(mockReq, mockRes);
      expect(originalHandler).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle request without URL', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => new Response('OK');
      const wrappedHandler = wrapper(handler);

      // Create request without proper URL
      const request = new Request('http://localhost:3000');
      const context = { params: {} };
      
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
    });

    test('should handle missing context params', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => new Response('OK');
      const wrappedHandler = wrapper(handler);

      const request = new Request('http://localhost:3000/api/test');
      const context = {}; // No params
      
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
    });

    test('should handle response without headers', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => {
        const response = new Response('OK');
        // Clear headers
        response.headers.delete('content-type');
        return response;
      };
      
      const wrappedHandler = wrapper(handler);
      const request = new Request('http://localhost:3000/api/test');
      const context = { params: {} };
      
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
    });

    test('should handle large request bodies', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => new Response('OK');
      const wrappedHandler = wrapper(handler);

      const largeBody = JSON.stringify({ data: 'x'.repeat(10000) });
      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: largeBody
      });
      
      const context = { params: {} };
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
    });

    test('should handle binary request bodies', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => new Response('OK');
      const wrappedHandler = wrapper(handler);

      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
      const request = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: binaryData
      });
      
      const context = { params: {} };
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
    });

    test('should handle form data requests', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => new Response('OK');
      const wrappedHandler = wrapper(handler);

      const formData = new FormData();
      formData.append('field1', 'value1');
      formData.append('field2', 'value2');
      
      const request = new Request('http://localhost:3000/api/form', {
        method: 'POST',
        body: formData
      });
      
      const context = { params: {} };
      const response = await wrappedHandler(request, context);
      expect(response.status).toBe(200);
    });

    test('should handle streaming responses', async () => {
      const wrapper = withTreblle(treblleOptions);
      
      const handler: NextRouteHandler = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('chunk1'));
            controller.enqueue(new TextEncoder().encode('chunk2'));
            controller.close();
          }
        });
        
        return new Response(stream, {
          headers: { 'content-type': 'text/plain' }
        });
      };
      
      const wrappedHandler = wrapper(handler);
      const request = new Request('http://localhost:3000/api/stream');
      const context = { params: {} };
      
      const response = await wrappedHandler(request, context);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });
});
