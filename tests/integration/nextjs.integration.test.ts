/**
 * @file tests/integration/nextjs.integration.test.ts
 * @description Integration tests for Next.js adapter with real HTTP requests
 */

import { withTreblle, treblleHandler } from '../../src/integrations/nextjs';
import type { NextRouteHandler } from '../../src/integrations/nextjs';

describe('Next.js Integration Tests', () => {
  const treblleOptions = {
    sdkToken: 'integration-test-sdk-token',
    apiKey: 'integration-test-api-key',
    debug: true,
    environments: {
      disabled: [] // Enable for integration tests
    }
  };

  describe('Real Route Handler Integration', () => {
    test('should wrap GET handler and process request', async () => {
      const getHandler: NextRouteHandler = async (request) => {
        const url = new URL(request.url);
        return Response.json({ 
          method: request.method,
          path: url.pathname,
          timestamp: new Date().toISOString()
        });
      };

      const wrappedHandler = withTreblle(treblleOptions)(getHandler);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'GET',
        headers: {
          'user-agent': 'Next.js Integration Test',
          'accept': 'application/json'
        }
      });

      const context = { params: {} };
      const response = await wrappedHandler(request, context);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.method).toBe('GET');
      expect(data.path).toBe('/api/users');
      expect(data.timestamp).toBeDefined();
    });

    test('should wrap POST handler with body processing', async () => {
      const postHandler: NextRouteHandler = async (request) => {
        const body = await request.json();
        
        return Response.json({
          success: true,
          received: body,
          id: Math.floor(Math.random() * 1000)
        }, { status: 201 });
      };

      const wrappedHandler = treblleHandler(postHandler, treblleOptions);

      const requestBody = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123'
      };

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Next.js Integration Test'
        },
        body: JSON.stringify(requestBody)
      });

      const context = { params: {} };
      const response = await wrappedHandler(request, context);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(201);
      
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.received).toEqual(requestBody);
      expect(data.id).toBeDefined();
    });

    test('should handle dynamic routes with parameters', async () => {
      const dynamicHandler: NextRouteHandler<{ id: string; action: string }> = async (request, context) => {
        const { params } = context;
        const url = new URL(request.url);
        
        return Response.json({
          method: request.method,
          userId: params?.id,
          action: params?.action,
          query: Object.fromEntries(url.searchParams.entries())
        });
      };

      const wrappedHandler = withTreblle(treblleOptions)(dynamicHandler);

      const request = new Request('http://localhost:3000/api/users/123/profile?include=avatar', {
        method: 'GET'
      });

      const context = { 
        params: { 
          id: '123', 
          action: 'profile' 
        } 
      };

      const response = await wrappedHandler(request, context);

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.userId).toBe('123');
      expect(data.action).toBe('profile');
      expect(data.query.include).toBe('avatar');
    });

    test('should handle errors and still capture them', async () => {
      const errorHandler: NextRouteHandler = async () => {
        throw new Error('Database connection failed');
      };

      const wrappedHandler = withTreblle(treblleOptions)(errorHandler);

      const request = new Request('http://localhost:3000/api/error', {
        method: 'GET'
      });

      const context = { params: {} };

      await expect(wrappedHandler(request, context)).rejects.toThrow('Database connection failed');
    });

    test('should handle async operations', async () => {
      const asyncHandler: NextRouteHandler = async () => {
        // Simulate async operations like database calls
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const data = await new Promise<{ result: string }>((resolve) => {
          setTimeout(() => {
            resolve({ result: 'Async operation completed' });
          }, 50);
        });

        return Response.json(data);
      };

      const wrappedHandler = withTreblle(treblleOptions)(asyncHandler);

      const request = new Request('http://localhost:3000/api/async', {
        method: 'GET'
      });

      const context = { params: {} };
      const startTime = Date.now();
      
      const response = await wrappedHandler(request, context);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(150); // Should take at least 150ms
      
      const data = await response.json() as any;
      expect(data.result).toBe('Async operation completed');
    });

    test('should handle large request/response payloads', async () => {
      const largeDataHandler: NextRouteHandler = async (request) => {
        const body = await request.json() as any;
        
        // Create a large response
        const largeResponse = {
          receivedItems: body.items,
          generatedData: Array(1000).fill(null).map((_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: `This is item number ${i} with some description text`.repeat(5)
          }))
        };

        return Response.json(largeResponse);
      };

      const wrappedHandler = withTreblle(treblleOptions)(largeDataHandler);

      const largeRequestBody = {
        items: Array(500).fill(null).map((_, i) => ({
          id: i,
          data: `Large data item ${i}`.repeat(10)
        }))
      };

      const request = new Request('http://localhost:3000/api/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(largeRequestBody)
      });

      const context = { params: {} };
      const response = await wrappedHandler(request, context);

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.receivedItems).toHaveLength(500);
      expect(data.generatedData).toHaveLength(1000);
    });

    test('should handle different HTTP methods correctly', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
      
      for (const method of methods) {
        const methodHandler: NextRouteHandler = async (request) => {
          return Response.json({ 
            method: request.method,
            processed: true 
          });
        };

        const wrappedHandler = withTreblle(treblleOptions)(methodHandler);

        const request = new Request('http://localhost:3000/api/test', {
          method,
          headers: { 'content-type': 'application/json' },
          body: method !== 'GET' ? JSON.stringify({ data: `${method} data` }) : undefined
        });

        const context = { params: {} };
        const response = await wrappedHandler(request, context);

        expect(response.status).toBe(200);
        
        const data = await response.json() as any;
        expect(data.method).toBe(method);
        expect(data.processed).toBe(true);
      }
    });

    test('should handle various response types', async () => {
      const responseTypes = [
        {
          name: 'JSON',
          handler: async (_req: Request, _ctx: { params?: any }) => Response.json({ type: 'json' }),
          contentType: 'application/json'
        },
        {
          name: 'Text',
          handler: async (_req: Request, _ctx: { params?: any }) => new Response('Plain text response', { 
            headers: { 'content-type': 'text/plain' }
          }),
          contentType: 'text/plain'
        },
        {
          name: 'HTML',
          handler: async (_req: Request, _ctx: { params?: any }) => new Response('<h1>HTML Response</h1>', {
            headers: { 'content-type': 'text/html' }
          }),
          contentType: 'text/html'
        },
        {
          name: 'Empty',
          handler: async (_req: Request, _ctx: { params?: any }) => new Response(null, { status: 204 }),
          contentType: null
        }
      ];

      for (const { name, handler, contentType } of responseTypes) {
        const wrappedHandler = withTreblle(treblleOptions)(handler);

        const request = new Request('http://localhost:3000/api/response-types', {
          method: 'GET'
        });

        const context = { params: {} };
        const response = await wrappedHandler(request, context);

        if (name === 'Empty') {
          expect(response.status).toBe(204);
        } else {
          expect(response.status).toBe(200);
          if (contentType) {
            expect(response.headers.get('content-type')).toBe(contentType);
          }
        }
      }
    });
  });

  describe('Error Scenarios', () => {
    test('should handle malformed JSON requests', async () => {
      const jsonHandler: NextRouteHandler = async (request) => {
        try {
          const body = await request.json();
          return Response.json({ received: body });
        } catch (error) {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }
      };

      const wrappedHandler = withTreblle(treblleOptions)(jsonHandler);

      const request = new Request('http://localhost:3000/api/json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json {'
      });

      const context = { params: {} };
      const response = await wrappedHandler(request, context);

      expect(response.status).toBe(400);
      
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid JSON');
    });

    test('should handle timeout scenarios', async () => {
      const timeoutHandler: NextRouteHandler = async () => {
        // Simulate a long-running operation
        await new Promise(resolve => setTimeout(resolve, 200));
        return Response.json({ completed: true });
      };

      const wrappedHandler = withTreblle(treblleOptions)(timeoutHandler);

      const request = new Request('http://localhost:3000/api/slow', {
        method: 'GET'
      });

      const context = { params: {} };
      const startTime = Date.now();
      
      const response = await wrappedHandler(request, context);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should work with minimal configuration', async () => {
      const minimalOptions = {
        sdkToken: 'minimal-test',
        apiKey: 'minimal-api'
      };

      const handler: NextRouteHandler = async () => {
        return Response.json({ status: 'ok' });
      };

      const wrappedHandler = withTreblle(minimalOptions)(handler);

      const request = new Request('http://localhost:3000/api/minimal');
      const context = { params: {} };
      
      const response = await wrappedHandler(request, context);

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.status).toBe('ok');
    });

    test('should handle requests with no body', async () => {
      const handler: NextRouteHandler = async (request) => {
        const hasBody = request.body !== null;
        return Response.json({ hasBody });
      };

      const wrappedHandler = withTreblle(treblleOptions)(handler);

      const request = new Request('http://localhost:3000/api/no-body', {
        method: 'POST' // POST without body
      });

      const context = { params: {} };
      const response = await wrappedHandler(request, context);

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.hasBody).toBe(false);
    });
  });
});
