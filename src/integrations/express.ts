/**
 * @file src/integrations/express.ts
 * @description Express framework integration for Treblle SDK
 */

import { RequestHandler, ErrorRequestHandler } from 'express';
import Treblle from '../index';
import { TreblleOptions } from '../types';
import { getTreblleInstance, clearInstances as clearInstancesImpl } from '../core/instance-manager';

/**
 * @function createTreblleMiddleware
 * @description Creates Express middleware for Treblle monitoring and stores the instance for reuse
 * @param options - Treblle configuration options
 * @returns Express middleware function
 */
export function createTreblleMiddleware(options: TreblleOptions): RequestHandler {
  const treblle = getTreblleInstance(options);
  return treblle.middleware() as RequestHandler;
}

/**
 * @function createTreblleErrorHandler
 * @description Creates Express error handler middleware for Treblle
 * @param options - Treblle configuration options (optional - uses default if not provided)
 * @returns Express error middleware function
 */
export function createTreblleErrorHandler(options?: TreblleOptions): ErrorRequestHandler {
  // Use default options if not provided for backward compatibility
  const treblleOptions = options || {
    sdkToken: process.env.TREBLLE_API_KEY || '',
    apiKey: process.env.TREBLLE_PROJECT_ID || '',
    debug: false
  };
  
  const treblle = getTreblleInstance(treblleOptions);
  return treblle.errorHandler() as ErrorRequestHandler;
}

/**
 * Express application extension to configure Treblle
 * @param app - Express application instance
 * @param options - Treblle configuration options
 */
export function configureTreblle(app: any, options: TreblleOptions): void {
  const treblle = getTreblleInstance(options);
  
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
  const treblle = getTreblleInstance(options);
  return treblle.middleware() as RequestHandler;
}

/**
 * @name TreblleMiddleware
 * @description Class-based middleware compatible with Express
 */
export class TreblleMiddleware {
  private treblle: Treblle;
  
  constructor(options: TreblleOptions) {
    this.treblle = getTreblleInstance(options);
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

/**
 * Clear all instances (for testing purposes)
 * Re-exported from instance manager
 */
export function clearInstances(): void {
  clearInstancesImpl();
}

// Default export with all Express integration functions
export default {
  createTreblleMiddleware,
  createTreblleErrorHandler,
  configureTreblle,
  applyTreblleToRoutes,
  TreblleMiddleware,
  clearInstances
};