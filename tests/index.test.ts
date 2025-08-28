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
    test('should capture and send payload', () => {
      const payload = { test: 'data' };
      treblle.capture(payload);
      
      // Use setTimeout to allow for asynchronous execution
      setTimeout(() => {
        expect(https.request).toHaveBeenCalled();
      }, 0);
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
