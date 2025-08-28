/**
 * @file tests/unit/transport.test.ts
 * @description Tests for the transport layer functionality
 */

import { sendToTreblle } from '../../src/core/transport';

// Mock fetch for Edge runtime tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock https for Node runtime tests
const mockRequest = {
  on: jest.fn().mockReturnThis(),
  setTimeout: jest.fn().mockReturnThis(),
  write: jest.fn().mockReturnThis(),
  end: jest.fn().mockReturnThis(),
  destroy: jest.fn().mockReturnThis()
};

const mockResponse = {
  on: jest.fn().mockReturnThis()
};

jest.mock('https', () => ({
  request: jest.fn().mockImplementation((_options, callback) => {
    // Simulate successful response
    setTimeout(() => callback(mockResponse), 0);
    return mockRequest;
  })
}));

describe('Transport Layer', () => {
  let originalProcess: any;
  let originalGlobalThis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    originalProcess = global.process;
    originalGlobalThis = globalThis;
    
    // Reset fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    });

    // Reset request mock behaviors
    mockRequest.on.mockReturnThis();
    mockRequest.setTimeout.mockReturnThis();
    mockRequest.write.mockReturnThis();
    mockRequest.end.mockReturnThis();
    mockResponse.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        setTimeout(callback, 0);
      }
      return mockResponse;
    });
  });

  afterEach(() => {
    global.process = originalProcess;
    (globalThis as any) = originalGlobalThis;
  });

  describe('Edge Runtime Detection', () => {
    test('should detect Edge runtime when EdgeRuntime is defined', async () => {
      (globalThis as any).EdgeRuntime = 'edge';
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' }
      });

      expect(mockFetch).toHaveBeenCalledWith('https://test.treblle.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        },
        body: JSON.stringify({ test: 'data' }),
        signal: expect.any(AbortSignal)
      });
    });

    test('should detect Edge runtime when process is undefined', async () => {
      delete (global as any).process;
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' }
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    test('should detect Edge runtime when hrtime is not available', async () => {
      global.process = { ...originalProcess };
      delete (global.process as any).hrtime;
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' }
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Edge Runtime Transport', () => {
    beforeEach(() => {
      (globalThis as any).EdgeRuntime = 'edge';
    });

    test('should send payload using fetch in Edge runtime', async () => {
      const payload = { test: 'data', nested: { value: 123 } };
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload
      });

      expect(mockFetch).toHaveBeenCalledWith('https://test.treblle.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        },
        body: JSON.stringify(payload),
        signal: expect.any(AbortSignal)
      });
    });

    test('should handle fetch timeout in Edge runtime', async () => {
      const abortSpy = jest.fn();
      const mockController = {
        abort: abortSpy,
        signal: { aborted: false }
      };
      
      global.AbortController = jest.fn().mockImplementation(() => mockController);
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' },
        timeoutMs: 100
      });

      // Wait for timeout to potentially trigger
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    test('should handle fetch errors in Edge runtime with debug', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' },
        debug: true
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Treblle SDK] Edge transport error:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle fetch errors silently without debug', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' },
        debug: false
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Node Runtime Transport', () => {
    beforeEach(() => {
      // Ensure we're in Node runtime for these tests
      delete (globalThis as any).EdgeRuntime;
      global.process = {
        ...originalProcess,
        hrtime: jest.fn(() => [0, 1000000])
      } as any;
    });

    test('should send payload using https in Node runtime', async () => {
      const https = require('https');
      const payload = { test: 'data', nested: { value: 123 } };
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com/api/v1',
        sdkToken: 'test-token',
        payload
      });

      expect(https.request).toHaveBeenCalledWith({
        method: 'POST',
        hostname: 'test.treblle.com',
        path: '/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        }
      }, expect.any(Function));

      expect(mockRequest.write).toHaveBeenCalledWith(JSON.stringify(payload));
      expect(mockRequest.end).toHaveBeenCalled();
    });

    test('should handle request timeout in Node runtime', async () => {
      let timeoutCallback: Function | undefined;
      mockRequest.setTimeout.mockImplementation((_ms: number, callback: Function) => {
        timeoutCallback = callback;
        return mockRequest;
      });

      const sendPromise = sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' },
        timeoutMs: 1000
      });

      // Wait for timeout callback to be set, then trigger it
      await new Promise(resolve => setTimeout(resolve, 10));
      if (timeoutCallback) {
        timeoutCallback();
      }
      
      await sendPromise;
      
      expect(mockRequest.setTimeout).toHaveBeenCalledWith(1000, expect.any(Function));
      expect(mockRequest.destroy).toHaveBeenCalled();
    });

    test('should handle request errors in Node runtime', async () => {
      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 0);
        }
        return mockRequest;
      });

      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' }
      });

      expect(mockRequest.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should handle URL parsing errors with debug', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await sendToTreblle({
        endpoint: 'invalid-url',
        sdkToken: 'test-token',
        payload: { test: 'data' },
        debug: true
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Treblle SDK] Node transport error:',
        expect.objectContaining({
          message: expect.any(String)
        })
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle URL parsing errors silently without debug', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await sendToTreblle({
        endpoint: 'invalid-url',
        sdkToken: 'test-token',
        payload: { test: 'data' },
        debug: false
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle URL with query parameters', async () => {
      const https = require('https');
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com/api?version=1&debug=true',
        sdkToken: 'test-token',
        payload: { test: 'data' }
      });

      expect(https.request).toHaveBeenCalledWith({
        method: 'POST',
        hostname: 'test.treblle.com',
        path: '/api?version=1&debug=true',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        }
      }, expect.any(Function));
    });
  });

  describe('Default Parameters', () => {
    test('should use default timeout when not specified', async () => {
      (globalThis as any).EdgeRuntime = 'edge';
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' }
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    test('should handle custom timeout', async () => {
      // Ensure we're in Node runtime for this test
      delete (globalThis as any).EdgeRuntime;
      global.process = {
        ...originalProcess,
        hrtime: jest.fn(() => [0, 1000000])
      } as any;
      
      const customTimeout = 2000;
      
      await sendToTreblle({
        endpoint: 'https://test.treblle.com',
        sdkToken: 'test-token',
        payload: { test: 'data' },
        timeoutMs: customTimeout
      });

      expect(mockRequest.setTimeout).toHaveBeenCalledWith(customTimeout, expect.any(Function));
    });
  });
});
