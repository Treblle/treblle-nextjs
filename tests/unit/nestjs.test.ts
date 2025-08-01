/**
 * @file tests/integrations/nestjs.test.ts
 * @description Tests for NestJS integration
 */

import {
    TreblleMiddleware,
    TreblleModule,
    TreblleExceptionFilter
  } from '../../src/integrations/nestjs';
  import Treblle from '../../src/index';
  import { Request, Response, NextFunction } from 'express';
  
  // Mock Treblle class
jest.mock('../../src/index', () => {
  return jest.fn().mockImplementation(() => {
  return {
  middleware: jest.fn().mockReturnValue((_req: Request, _res: Response, next: NextFunction) => next()),
  errorHandler: jest.fn().mockReturnValue((_err: Error, _req: Request, _res: Response, next: NextFunction) => next(_err))
  };
  });
});
  
  describe('NestJS Integration', () => {
    const options = {
      sdkToken: 'test-sdk-token',
      apiKey: 'test-api-key'
    };
  
    beforeEach(() => {
      // Clear mock calls before each test
      jest.clearAllMocks();
    });
  
    describe('TreblleMiddleware', () => {
      test('should create and use middleware', () => {
        const middleware = new TreblleMiddleware(options);
        
        // Should create a Treblle instance
        expect(Treblle).toHaveBeenCalledWith(options);
        
        // Call middleware
        const req = {} as Request;
        const res = {} as Response;
        const next = jest.fn();
        
        middleware.use(req, res, next);
        
        // Should call treblle.middleware
        const treblleInstance = (Treblle as jest.Mock).mock.results[0].value;
        expect(treblleInstance.middleware).toHaveBeenCalled();
        
        // Should call next
        expect(next).toHaveBeenCalled();
      });

      test('should handle middleware with different configurations', () => {
        const customOptions = {
          sdkToken: 'custom-sdk-token',
          apiKey: 'custom-api-key',
          debug: true
        };
        
        new TreblleMiddleware(customOptions);
        expect(Treblle).toHaveBeenCalledWith(customOptions);
      });

      test('should handle request/response cycle', () => {
        const middleware = new TreblleMiddleware(options);
        
        const req = {
          method: 'GET',
          url: '/test',
          headers: { 'content-type': 'application/json' }
        } as Request;
        const res = {
          statusCode: 200,
          setHeader: jest.fn(),
          getHeaders: jest.fn().mockReturnValue({})
        } as unknown as Response;
        const next = jest.fn();
        
        middleware.use(req, res, next);
        
        expect(next).toHaveBeenCalled();
      });
    });
  
    describe('TreblleModule', () => {
      test('should register dynamic module', () => {
        const dynamicModule = TreblleModule.register(options);
        
        // Check module structure
        expect(dynamicModule.module).toBe(TreblleModule);
        expect(dynamicModule.providers).toHaveLength(1);
        expect(dynamicModule.exports).toContain(TreblleMiddleware);
        
        // Create provider instance
        const provider = dynamicModule.providers![0] as any;
        expect(provider.provide).toBe(TreblleMiddleware);
        
        // Call factory function
        const factory = provider.useFactory as () => TreblleMiddleware;
        const instance = factory();
        
        // Should create TreblleMiddleware with options
        expect(instance).toBeInstanceOf(TreblleMiddleware);
        expect(Treblle).toHaveBeenCalledWith(options);
      });

      test('should handle minimal options', () => {
        const minimalOptions = { sdkToken: 'test', apiKey: 'test' };
        const dynamicModule = TreblleModule.register(minimalOptions);
        
        const provider = dynamicModule.providers![0] as any;
        const factory = provider.useFactory as () => TreblleMiddleware;
        const instance = factory();
        
        expect(instance).toBeInstanceOf(TreblleMiddleware);
        expect(Treblle).toHaveBeenCalledWith(minimalOptions);
      });

      test('should create singleton providers', () => {
        const dynamicModule = TreblleModule.register(options);
        
        expect(dynamicModule.providers).toHaveLength(1);
        expect(dynamicModule.exports).toContain(TreblleMiddleware);
        
        const provider = dynamicModule.providers![0] as any;
        expect(provider.provide).toBe(TreblleMiddleware);
        expect(typeof provider.useFactory).toBe('function');
      });
    });
  
    describe('TreblleExceptionFilter', () => {
      test('should catch exceptions', () => {
        const filter = new TreblleExceptionFilter(options);
        
        // Should create a Treblle instance
        expect(Treblle).toHaveBeenCalledWith(options);
        
        // Create mock exception host
        const req = {} as Request;
        const res = { _treblleErrors: [] } as unknown as Response;
        const host = {
          getArgs: jest.fn(),
          getArgByIndex: jest.fn(),
          switchToRpc: jest.fn(),
          switchToWs: jest.fn(),
          getType: jest.fn(),
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(req),
            getResponse: jest.fn().mockReturnValue(res)
          })
        } as any;
        
        // Create test error
        const error = new Error('Test error');
        
        // Call should throw the error back
        expect(() => filter.catch(error, host)).toThrow(error);
        
        // Should call treblle.errorHandler
        const treblleInstance = (Treblle as jest.Mock).mock.results[0].value;
        expect(treblleInstance.errorHandler).toHaveBeenCalled();
      });

      test('should handle different error types', () => {
        const filter = new TreblleExceptionFilter(options);
        
        const req = {} as Request;
        const res = { _treblleErrors: [] } as unknown as Response;
        const host = {
          getArgs: jest.fn(),
          getArgByIndex: jest.fn(),
          switchToRpc: jest.fn(),
          switchToWs: jest.fn(),
          getType: jest.fn(),
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(req),
            getResponse: jest.fn().mockReturnValue(res)
          })
        } as any;
        
        // Test different error types
        const errors = [
          new Error('Standard error'),
          new TypeError('Type error'),
          new ReferenceError('Reference error')
        ];
        
        errors.forEach(error => {
          expect(() => filter.catch(error, host)).toThrow(error);
        });
      });

      test('should handle requests without _treblleErrors', () => {
        const filter = new TreblleExceptionFilter(options);
        
        const req = {} as Request;
        const res = {} as Response; // No _treblleErrors property
        const host = {
          getArgs: jest.fn(),
          getArgByIndex: jest.fn(),
          switchToRpc: jest.fn(),
          switchToWs: jest.fn(),
          getType: jest.fn(),
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(req),
            getResponse: jest.fn().mockReturnValue(res)
          })
        } as any;
        
        const error = new Error('Test error');
        
        expect(() => filter.catch(error, host)).toThrow(error);
      });
    });
  });