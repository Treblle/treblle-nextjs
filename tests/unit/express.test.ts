/**
 * @file tests/integrations/express.test.ts
 * @description Tests for Express integration
 */

import {
    createTreblleMiddleware,
    createTreblleErrorHandler,
    configureTreblle,
    applyTreblleToRoutes,
    TreblleMiddleware,
    clearInstances
  } from '../../src/integrations/express';
  import { Request, Response, NextFunction } from 'express';
  import { getTreblleInstance } from '../../src/core/instance-manager';
  
  // Mock instance manager
  jest.mock('../../src/core/instance-manager', () => {
    const mockTreblle = {
      middleware: jest.fn().mockReturnValue((_req: Request, _res: Response, next: NextFunction) => next()),
      errorHandler: jest.fn().mockReturnValue((err: Error, _req: Request, _res: Response, next: NextFunction) => next(err))
    };
    
    return {
      getTreblleInstance: jest.fn().mockReturnValue(mockTreblle),
      clearInstances: jest.fn()
    };
  });
  
  describe('Express Integration', () => {
    const options = {
      sdkToken: 'test-sdk-token',
      apiKey: 'test-api-key'
    };
  
    beforeEach(() => {
      // Clear mock calls before each test
      jest.clearAllMocks();
    });
  
    test('should create middleware function', () => {
      const middleware = createTreblleMiddleware(options);
      
      // Should get a Treblle instance
      expect(getTreblleInstance).toHaveBeenCalledWith(options);
      
      // Should be a function
      expect(typeof middleware).toBe('function');
      
      // Call middleware
      const req = {} as Request;
      const res = {} as Response;
      const next = jest.fn();
      
      middleware(req, res, next);
      
      // Should call next
      expect(next).toHaveBeenCalled();
    });
  
    test('should create error handler function', () => {
      const errorHandler = createTreblleErrorHandler(options);
      
      // Should get a Treblle instance
      expect(getTreblleInstance).toHaveBeenCalledWith(options);
      
      // Should be a function
      expect(typeof errorHandler).toBe('function');
      
      // Call error handler
      const err = new Error('Test error');
      const req = {} as Request;
      const res = {} as Response;
      const next = jest.fn();
      
      errorHandler(err, req, res, next);
      
      // Should call next with error
      expect(next).toHaveBeenCalledWith(err);
    });
  
    test('should configure Express app', () => {
      const app = {
        use: jest.fn()
      };
      
      configureTreblle(app, options);
      
      // Should get a Treblle instance
      expect(getTreblleInstance).toHaveBeenCalledWith(options);
      
      // Should add middleware and error handler to app
      expect(app.use).toHaveBeenCalledTimes(2);
    });
  
    test('should apply Treblle to routes', () => {
      const middleware = applyTreblleToRoutes(options);
      
      // Should get a Treblle instance
      expect(getTreblleInstance).toHaveBeenCalledWith(options);
      
      // Should return middleware
      expect(typeof middleware).toBe('function');
    });
    
    test('should create error handler with default options', () => {
      const errorHandler = createTreblleErrorHandler();
      
      // Should be a function
      expect(typeof errorHandler).toBe('function');
      
      // Should get a Treblle instance with default options
      expect(getTreblleInstance).toHaveBeenCalled();
    });
    
    test('should create TreblleMiddleware class instance', () => {
      const middleware = new TreblleMiddleware(options);
      
      // Should get a Treblle instance
      expect(getTreblleInstance).toHaveBeenCalledWith(options);
      
      // Should have use method
      expect(typeof middleware.use).toBe('function');
      
      // Should have handleError method
      expect(typeof middleware.handleError).toBe('function');
      
      // Test use method
      const req = {} as Request;
      const res = {} as Response;
      const next = jest.fn();
      
      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
      
      // Test handleError method
      const err = new Error('Test error');
      const nextError = jest.fn();
      
      middleware.handleError(err, req, res, nextError);
      expect(nextError).toHaveBeenCalledWith(err);
    });
    
    test('should clear instances', () => {
      clearInstances();
      
      // Should call the clearInstances function from instance manager
      expect(require('../../src/core/instance-manager').clearInstances).toHaveBeenCalled();
    });
  });
