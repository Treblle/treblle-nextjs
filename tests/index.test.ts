/**
 * @file tests/index.test.ts
 * @description Core tests for the Treblle SDK functionality (NextJS only)
 */

import Treblle from '../src';
import https from 'https';

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
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, writable: true, configurable: true });
    }
  });

  describe('Initialization', () => {
    test('should initialize with required options', () => {
      expect(treblle).toBeDefined();
      expect((treblle as any).sdkToken).toBe('test-sdk-token');
      expect((treblle as any).apiKey).toBe('test-api-key');
      expect((treblle as any).debug).toBe(true);
    });

    test('should handle missing SDK token', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      new Treblle({
        apiKey: 'test-api-key'
      } as any);

      // Should have logged an error but not throw
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Treblle SDK requires an SDK token')
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle missing API key', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      new Treblle({
        sdkToken: 'test-sdk-token'
      } as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Treblle SDK requires an API key')
      );
      
      consoleSpy.mockRestore();
    });

    test('should initialize with default values when not provided', () => {
      const defaultTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key'
      });

      expect((defaultTreblle as any).debug).toBe(false);
      expect((defaultTreblle as any).enabled).toBe(true);
      expect((defaultTreblle as any).excludePaths).toEqual([]);
      expect((defaultTreblle as any).includePaths).toEqual([]);
    });
  });

  describe('Error Formatting', () => {
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

    test('should handle errors without stack traces', () => {
      const error = new Error('Test error');
      delete (error as any).stack;
      
      const processedError = treblle.formatError(error);
      
      expect(processedError.message).toBe('Test error');
      expect(processedError.file).toBe('unknown');
      expect(processedError.line).toBe(0);
    });
  });

  describe('Path Filtering', () => {
    test('should exclude paths matching patterns', () => {
      const treblleWithExcludes = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: ['/health', '/api/internal/*']
      });
      
      expect(treblleWithExcludes.shouldExcludePath('/health')).toBe(true);
      expect(treblleWithExcludes.shouldExcludePath('/api/internal/status')).toBe(true);
      expect(treblleWithExcludes.shouldExcludePath('/api/public/users')).toBe(false);
    });

    test('should include only specified paths when includePaths is set', () => {
      const treblleWithIncludes = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        includePaths: ['/api/v1/*']
      });
      
      expect(treblleWithIncludes.isPathIncluded('/api/v1/users')).toBe(true);
      expect(treblleWithIncludes.isPathIncluded('/api/v2/users')).toBe(false);
    });

    test('should handle regex patterns', () => {
      const treblleWithRegex = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: [/^\/admin\/.*/]
      });
      
      expect(treblleWithRegex.shouldExcludePath('/admin/users')).toBe(true);
      expect(treblleWithRegex.shouldExcludePath('/api/admin/users')).toBe(false);
    });
  });

  describe('Data Capture', () => {
    test('should capture and send payload', async () => {
      const payload = { test: 'data' };
      treblle.capture(payload);
      
      // Allow asynchronous execution and assert
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
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

  describe('Middleware Functionality', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;
    let middleware: any;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        url: '/api/test',
        originalUrl: '/api/test',
        headers: {
          'user-agent': 'test-agent',
          'host': 'localhost:3000'
        },
        body: { test: 'data' },
        query: { param: 'value' },
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3000'),
        connection: { encrypted: false }
      };

      mockRes = {
        statusCode: 200,
        send: jest.fn(),
        json: jest.fn(),
        end: jest.fn(),
        getHeader: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({}),
        _treblleErrors: []
      };

      mockNext = jest.fn();
      middleware = treblle.middleware();
    });

    test('should create middleware function', () => {
      expect(typeof middleware).toBe('function');
    });

    test('should skip when SDK is disabled', () => {
      const disabledTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        enabled: false
      });
      
      const disabledMiddleware = disabledTreblle.middleware();
      disabledMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should skip excluded paths', () => {
      const treblleWithExcludes = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: ['/api/test']
      });
      
      const excludeMiddleware = treblleWithExcludes.middleware();
      excludeMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should skip non-included paths when includePaths is set', () => {
      const treblleWithIncludes = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        includePaths: ['/api/allowed']
      });
      
      const includeMiddleware = treblleWithIncludes.middleware();
      includeMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should process request and capture data on response end', () => {
      middleware(mockReq, mockRes, mockNext);
      
      // Simulate response end
      mockRes.end('response data');
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq._treblleRoutePath).toBeDefined();
      expect(mockRes._treblleErrors).toBeDefined();
    });

    test('should handle JSON response', () => {
      middleware(mockReq, mockRes, mockNext);
      
      const responseData = { success: true, data: 'test' };
      mockRes.json(responseData);
      mockRes.end();
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle file uploads', () => {
      mockReq.file = {
        fieldname: 'upload',
        originalname: 'test.txt',
        size: 1024,
        mimetype: 'text/plain',
        buffer: Buffer.from('test content')
      };
      
      middleware(mockReq, mockRes, mockNext);
      mockRes.end();
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle multiple file uploads', () => {
      mockReq.files = {
        uploads: [{
          originalname: 'file1.txt',
          size: 1024,
          mimetype: 'text/plain'
        }, {
          originalname: 'file2.txt',
          size: 2048,
          mimetype: 'text/plain'
        }]
      };
      
      middleware(mockReq, mockRes, mockNext);
      mockRes.end();
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle binary response', () => {
      mockRes.getHeader = jest.fn().mockImplementation((header) => {
        if (header === 'content-type') return 'application/octet-stream';
        if (header === 'content-disposition') return 'attachment; filename="file.bin"';
        return '';
      });
      
      middleware(mockReq, mockRes, mockNext);
      mockRes.end(Buffer.from('binary data'));
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle different content types', () => {
      mockRes.getHeader = jest.fn().mockImplementation((header) => {
        if (header === 'content-type') return 'image/png';
        return '';
      });
      
      middleware(mockReq, mockRes, mockNext);
      mockRes.end();
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should parse query parameters from URL when req.query is not available', () => {
      delete mockReq.query;
      mockReq.originalUrl = '/api/test?param1=value1&param2=value2';
      
      middleware(mockReq, mockRes, mockNext);
      mockRes.end();
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle malformed URLs gracefully', () => {
      delete mockReq.query;
      mockReq.originalUrl = 'invalid-url';
      mockReq.get = jest.fn().mockReturnValue(null);
      
      middleware(mockReq, mockRes, mockNext);
      mockRes.end();
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Error Handler Middleware', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;
    let errorHandler: any;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        _treblleErrors: []
      };
      mockNext = jest.fn();
      errorHandler = treblle.errorHandler();
    });

    test('should create error handler function', () => {
      expect(typeof errorHandler).toBe('function');
    });

    test('should skip when SDK is disabled', () => {
      const disabledTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        enabled: false
      });
      
      const disabledErrorHandler = disabledTreblle.errorHandler();
      const error = new Error('Test error');
      
      disabledErrorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should capture and format errors', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error\n    at Object.<anonymous> (/path/to/file.js:10:5)`;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes._treblleErrors).toHaveLength(1);
      expect(mockRes._treblleErrors[0]).toEqual({
        file: 'file.js',
        line: 10,
        message: 'Test error'
      });
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should initialize error array if not exists', () => {
      delete mockRes._treblleErrors;
      const error = new Error('Test error');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes._treblleErrors).toBeDefined();
      expect(mockRes._treblleErrors).toHaveLength(1);
    });

    test('should handle null/undefined errors', () => {
      errorHandler(null, mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(null);
    });
  });

  describe('Private Methods', () => {
    test('should handle HTTPS URL validation', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Test with HTTP URL (should trigger error)
      const payload = { test: 'data' };
      treblle.capture(payload);
      
      consoleSpy.mockRestore();
    });

    test('should handle _sendPayload errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock Math.random to return predictable endpoint
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0);
      
      const payload = { test: 'data' };
      treblle.capture(payload);
      
      // Allow async execution
      await new Promise(resolve => setTimeout(resolve, 0));
      
      Math.random = originalRandom;
      consoleSpy.mockRestore();
    });

    test('should match wildcard patterns correctly', () => {
      const treblleWithWildcard = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: ['/api/internal/*']
      });
      
      expect(treblleWithWildcard.shouldExcludePath('/api/internal/status')).toBe(true);
      expect(treblleWithWildcard.shouldExcludePath('/api/internal/health/check')).toBe(true);
      expect(treblleWithWildcard.shouldExcludePath('/api/public/users')).toBe(false);
    });

    test('should handle trailing slashes in path matching', () => {
      const treblleWithPaths = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        excludePaths: ['/health/']
      });
      
      expect(treblleWithPaths.shouldExcludePath('/health')).toBe(true);
      expect(treblleWithPaths.shouldExcludePath('/health/')).toBe(true);
    });
  });

  describe('Environment Handling', () => {
    test('should be enabled by default in all environments', () => {
      process.env = { NODE_ENV: 'production' } as any;
      const prodTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key'
      });
      
      expect((prodTreblle as any).enabled).toBe(true);
    });

    test('should respect explicit disabled setting', () => {
      const disabledTreblle = new Treblle({
        sdkToken: 'test-sdk-token',
        apiKey: 'test-api-key',
        enabled: false
      });
      
      expect((disabledTreblle as any).enabled).toBe(false);
    });
  });
});
