/**
 * @file tests/integrations/express.test.ts
 * @description Tests for Express integration
 */

import {
    createTreblleMiddleware,
    createTreblleErrorHandler,
    configureTreblle,
    applyTreblleToRoutes
  } from '../../src/integrations/express';
  import Treblle from '../../src/index';
  import { Request, Response, NextFunction, RequestHandler } from 'express';
  
  // Mock Treblle class
  jest.mock('../../src/index', () => {
    return jest.fn().mockImplementation(() => {
      return {
        middleware: jest.fn().mockReturnValue((req: Request, res: Response, next: NextFunction) => next()),
        errorHandler: jest.fn().mockReturnValue((err: Error, req: Request, res: Response, next: NextFunction) => next(err))
      };
    });
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
      
      // Should create a Treblle instance
      expect(Treblle).toHaveBeenCalledWith(options);
      
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
      
      // Should create a Treblle instance
      expect(Treblle).toHaveBeenCalledWith(options);
      
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
      
      // Should create a Treblle instance
      expect(Treblle).toHaveBeenCalledWith(options);
      
      // Should add middleware and error handler to app
      expect(app.use).toHaveBeenCalledTimes(2);
    });
  
    test('should apply Treblle to routes', () => {
      const router = {};
      
      const middleware = applyTreblleToRoutes(options, router);
      
      // Should create a Treblle instance
      expect(Treblle).toHaveBeenCalledWith(options);
      
      // Should return middleware
      expect(typeof middleware).toBe('function');
    });
  });