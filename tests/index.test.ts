/**
 * @file tests/index.test.ts
 * @description Comprehensive tests for the core Treblle SDK functionality
 */

import Treblle from '../src';
import https from 'https';
import { Request, Response } from 'express';

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

describe('Treblle SDK Core Functionality', () => {
  let treblle: Treblle;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    
    // Reset console.error mock
    console.error = jest.fn();
    console.log = jest.fn();
    
    // Create Treblle instance
    treblle = new Treblle({
      sdkToken: 'test-sdk-token',
      apiKey: 'test-api-key',
      debug: true
    });
    
    // Mock request object
    mockReq = {
      method: 'GET',
      protocol: 'http',
      originalUrl: '/api/test',
      url: '/api/test',
      connection: { remoteAddress: '127.0.0.1' } as any,
      socket: { remoteAddress: '127.0.0.1' } as any,
      headers: {
        host: 'localhost:3000',
        'user-agent': 'Jest Test',
        'x-forwarded-for': '192.168.1.100'
      },
      body: {
        test: 'value',
        password: 'secret123'
      },
      get: jest.fn().mockImplementation(key => (mockReq.headers as any)[key.toLowerCase()])
    };
    
    // Mock response object with proper method binding
    mockRes = {
      statusCode: 200,
      getHeaders: jest.fn().mockReturnValue({}),
      getHeader: jest.fn().mockReturnValue(''),
      send: jest.fn(function(this: any, body) { 
        this._sentBody = body;
        return this; 
      }),
      json: jest.fn(function(this: any, body) { 
        this._sentBody = body;
        return this; 
      }),
      end: jest.fn(function(this: any, chunk) { 
        if (chunk) this._endChunk = chunk;
        return this; 
      }),
      on: jest.fn()
    };
    
    // Mock next function
    mockNext = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Initialization', () => {
    test('should initialize with correct config', () => {
      expect((treblle as any).sdkToken).toBe('test-sdk-token');
      expect((treblle as any).apiKey).toBe('test-api-key');
      expect((treblle as any).debug).toBe(true);
      expect((treblle as any).enabled).toBe(true);
    });

    test('should handle missing SDK token', () => {
      new Treblle({
        apiKey: 'test-api-key'
      } as any);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Treblle SDK Error]:', 
        expect.stringContaining('SDK token')
      );
    });

    test('should handle missing API key', () => {
      new Treblle({
        sdkToken: 'test-sdk-token'
      } as any);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Treblle SDK Error]:', 
        expect.stringContaining('API key')
      );
    });

    test('should set default values correctly', () => {
      const defaultTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key'
      });
      
      expect((defaultTreblle as any).debug).toBe(false);
      expect((defaultTreblle as any).excludePaths).toEqual([]);
      expect((defaultTreblle as any).includePaths).toEqual([]);
    });
  });

  describe('Middleware', () => {
    test('should create middleware function', () => {
      const middleware = treblle.middleware();
      expect(typeof middleware).toBe('function');
    });

    test('should call next when SDK is disabled', () => {
      const disabledTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        enabled: false
      });
      
      const middleware = disabledTreblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should skip excluded paths', () => {
      const treblleWithExcludes = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: ['/health', '/api/internal/*']
      });
      
      mockReq.originalUrl = '/health';
      const middleware = treblleWithExcludes.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should process included paths only when includePaths is set', () => {
      const treblleWithIncludes = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        includePaths: ['/api/v1/*']
      });
      
      // Test excluded path
      mockReq.originalUrl = '/api/v2/test';
      const middleware = treblleWithIncludes.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should capture request timing', () => {
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Simulate response end
      const endFn = (mockRes as any).end;
      endFn.call(mockRes, JSON.stringify({ success: true }));
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should override response methods', () => {
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Check that send and json methods are overridden
      expect(typeof (mockRes as any).send).toBe('function');
      expect(typeof (mockRes as any).json).toBe('function');
      expect(typeof (mockRes as any).end).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('should create error handler function', () => {
      const errorHandler = treblle.errorHandler();
      expect(typeof errorHandler).toBe('function');
    });

    test('should add errors to response object', () => {
      const errorHandler = treblle.errorHandler();
      const error = new Error('Test error');
      
      (mockRes as any)._treblleErrors = [];
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect((mockRes as any)._treblleErrors.length).toBe(1);
      expect((mockRes as any)._treblleErrors[0].message).toBe('Test error');
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should handle error when SDK is disabled', () => {
      const disabledTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        enabled: false
      });
      
      const errorHandler = disabledTreblle.errorHandler();
      const error = new Error('Test error');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should process error stack trace', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.<anonymous> (/path/to/file.js:10:5)
    at Module._compile (module.js:456:26)`;
      
      const processedError = treblle.formatError(error);
      
      expect(processedError.message).toBe('Test error');
      expect(processedError.file).toBe('file.js');
      expect(processedError.line).toBe(10);
    });

    test('should handle malformed stack traces', () => {
      const error = new Error('Test error');
      error.stack = 'Invalid stack trace format';
      
      const processedError = treblle.formatError(error);
      
      expect(processedError.message).toBe('Test error');
      expect(processedError.file).toBe('unknown');
      expect(processedError.line).toBe(0);
    });
  });

  describe('Environment Configuration', () => {
    test('should respect enabled flag', () => {
      const enabledTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        enabled: true
      });
      
      expect((enabledTreblle as any).enabled).toBe(true);
    });

    test('should disable in specified environments', () => {
      process.env.NODE_ENV = 'test';
      
      const treblleWithDisabledEnv = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        environments: {
          disabled: ['test']
        }
      });
      
      expect((treblleWithDisabledEnv as any).enabled).toBe(false);
    });

    test('should enable only in specified environments', () => {
      process.env.NODE_ENV = 'development';
      
      const treblleWithEnabledEnv = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        environments: {
          enabled: ['production'],
          default: false
        }
      });
      
      expect((treblleWithEnabledEnv as any).enabled).toBe(false);
    });
  });

  describe('Path Filtering', () => {
    test('should match exact paths', () => {
      const treblleWithPaths = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: ['/health']
      });
      
      expect((treblleWithPaths as any)._shouldExcludePath('/health')).toBe(true);
      expect((treblleWithPaths as any)._shouldExcludePath('/health-check')).toBe(false);
    });

    test('should match wildcard patterns', () => {
      const treblleWithPaths = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: ['/api/internal/*']
      });
      
      expect((treblleWithPaths as any)._shouldExcludePath('/api/internal/users')).toBe(true);
      expect((treblleWithPaths as any)._shouldExcludePath('/api/public/users')).toBe(false);
    });

    test('should match regex patterns', () => {
      const treblleWithPaths = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: [/^\/admin\/.*/]
      });
      
      expect((treblleWithPaths as any)._shouldExcludePath('/admin/users')).toBe(true);
      expect((treblleWithPaths as any)._shouldExcludePath('/user/admin')).toBe(false);
    });
  });

  describe('Data Capture', () => {
    test('should capture request data', () => {
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Verify route path is captured
      expect((mockReq as any)._treblleRoutePath).toBeDefined();
      expect((mockRes as any)._treblleErrors).toEqual([]);
    });

    test('should send payload when capture is called', () => {
      const payload = { test: 'data' };
      treblle.capture(payload);
      
      expect(https.request).toHaveBeenCalled();
    });

    test('should not send payload when disabled', () => {
      const disabledTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        enabled: false
      });
      
      const payload = { test: 'data' };
      disabledTreblle.capture(payload);
      
      expect(https.request).not.toHaveBeenCalled();
    });
  });

  describe('File Handling', () => {
    test('should detect file uploads in request', () => {
      mockReq.file = {
        fieldname: 'upload',
        originalname: 'test.jpg',
        size: 12345,
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data')
      } as any;
      
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Simulate response end to trigger processing
      const endFn = (mockRes as any).end;
      endFn.call(mockRes, JSON.stringify({ success: true }));
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should detect file responses', () => {
      (mockRes as any).getHeader = jest.fn().mockImplementation((header: string) => {
        if (header === 'content-disposition') return 'attachment; filename="test.pdf"';
        if (header === 'content-type') return 'application/pdf';
        return '';
      });
      
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Simulate response end
      const endFn = (mockRes as any).end;
      endFn.call(mockRes, Buffer.from('pdf-data'));
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Response Processing', () => {
    test('should handle JSON responses', () => {
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const jsonData = { user: 'test', success: true };
      (mockRes as any).json(jsonData);
      
      expect((mockRes as any)._sentBody).toEqual(jsonData);
    });

    test('should handle text responses', () => {
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const textData = 'Plain text response';
      (mockRes as any).send(textData);
      
      expect((mockRes as any)._sentBody).toBe(textData);
    });

    test('should handle binary responses', () => {
      const middleware = treblle.middleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const binaryData = Buffer.from('binary data');
      const endFn = (mockRes as any).end;
      endFn.call(mockRes, binaryData);
      
      expect((mockRes as any)._endChunk).toBe(binaryData);
    });
  });
});