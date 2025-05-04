/**
 * @file src/integrations/express.ts
 * @description Express framework integration for Treblle SDK
 */

import { RequestHandler, ErrorRequestHandler } from 'express';
import Treblle from '../index';
import { TreblleOptions } from '../types';
import { TreblleInstanceManager } from './instance-manager';

/**
 * @function createTreblleMiddleware
 * @description Creates Express middleware for Treblle monitoring
 * @param options - Treblle configuration options
 * @returns Express middleware function
 */
export function createTreblleMiddleware(options: TreblleOptions): RequestHandler {
  const treblle = TreblleInstanceManager.getInstance(options, 'Express');
  return treblle.middleware() as RequestHandler;
}

/**
 * @function createTreblleErrorHandler
 * @description Creates Express error handler middleware for Treblle
 * @param options - Treblle configuration options (optional if middleware was created first)
 * @returns Express error middleware function
 */
export function createTreblleErrorHandler(options?: TreblleOptions): ErrorRequestHandler {
  let treblle: Treblle;
  
  if (options) {
    treblle = TreblleInstanceManager.getInstance(options, 'Express');
  } else {
    // If no options provided but instances exist, use the latest instance
    const latestInstance = TreblleInstanceManager.getLatestInstance();
    
    if (!latestInstance) {
      throw new Error('No Treblle instance found. Create middleware first or provide options.');
    }
    
    treblle = latestInstance;
  }
  
  return treblle.errorHandler() as ErrorRequestHandler;
}

/**
 * Express application extension to configure Treblle
 * @param app - Express application instance
 * @param options - Treblle configuration options
 */
export function configureTreblle(app: any, options: TreblleOptions): void {
  const treblle = TreblleInstanceManager.getInstance(options, 'Express');
  
  // Apply Treblle middleware globally
  app.use(treblle.middleware() as RequestHandler);
  
  // Apply Treblle error handler
  app.use(treblle.errorHandler() as ErrorRequestHandler);
}

/**
 * Helper function to apply Treblle to specific routes
 * @param options - Treblle configuration options
 * @returns RequestHandler middleware
 */
export function applyTreblleToRoutes(options: TreblleOptions): RequestHandler {
  const treblle = TreblleInstanceManager.getInstance(options, 'Express');
  return treblle.middleware() as RequestHandler;
}

/**
 * @name TreblleMiddleware
 * @description Class-based middleware compatible with Express
 */
export class TreblleMiddleware {
  private treblle: Treblle;
  
  constructor(options: TreblleOptions) {
    this.treblle = TreblleInstanceManager.getInstance(options, 'Express');
  }
  
  use(req: any, res: any, next: any): void {
    const middleware = this.treblle.middleware();
    middleware(req, res, next);
  }
  
  handleError(err: Error, req: any, res: any, next: any): void {
    const errorHandler = this.treblle.errorHandler();
    errorHandler(err, req, res, next);
  }
}

// Default export with all Express integration functions
export default {
  createTreblleMiddleware,
  createTreblleErrorHandler,
  configureTreblle,
  applyTreblleToRoutes,
  TreblleMiddleware
};