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
        middleware: jest.fn().mockReturnValue((req: Request, res: Response, next: NextFunction) => next()),
        errorHandler: jest.fn().mockReturnValue((err: Error, req: Request, res: Response, next: NextFunction) => next(err))
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
    });
  
    describe('TreblleModule', () => {
      test('should register dynamic module', () => {
        const dynamicModule = TreblleModule.register(options);
        
        // Check module structure
        expect(dynamicModule.module).toBe(TreblleModule);
        expect(dynamicModule.providers).toHaveLength(1);
        expect(dynamicModule.exports).toContain(TreblleMiddleware);
        
        // Create provider instance
        const provider = dynamicModule.providers[0];
        expect(provider.provide).toBe(TreblleMiddleware);
        
        // Call factory function
        const factory = provider.useFactory as () => TreblleMiddleware;
        const instance = factory();
        
        // Should create TreblleMiddleware with options
        expect(instance).toBeInstanceOf(TreblleMiddleware);
        expect(Treblle).toHaveBeenCalledWith(options);
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
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(req),
            getResponse: jest.fn().mockReturnValue(res)
          })
        };
        
        // Create test error
        const error = new Error('Test error');
        
        // Call should throw the error back
        expect(() => filter.catch(error, host)).toThrow(error);
        
        // Should call treblle.errorHandler
        const treblleInstance = (Treblle as jest.Mock).mock.results[0].value;
        expect(treblleInstance.errorHandler).toHaveBeenCalled();
      });
    });
  });