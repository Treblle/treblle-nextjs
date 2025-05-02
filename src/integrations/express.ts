/**
 * @file src/integrations/express.ts
 * @description Express framework integration for Treblle SDK
 */

import { RequestHandler, ErrorRequestHandler } from 'express';
import Treblle from '../index';
import { TreblleOptions } from '../types';

/**
 * @function createTreblleMiddleware
 * @description Creates Express middleware for Treblle monitoring
 * @param options - Treblle configuration options
 * @returns Express middleware function
 */
export function createTreblleMiddleware(options: TreblleOptions): RequestHandler {
  const treblle = new Treblle(options);
  return treblle.middleware() as RequestHandler;
}

/**
 * @function createTreblleErrorHandler
 * @description Creates Express error handler middleware for Treblle
 * @param options - Treblle configuration options
 * @returns Express error middleware function
 */
export function createTreblleErrorHandler(options: TreblleOptions): ErrorRequestHandler {
  const treblle = new Treblle(options);
  return treblle.errorHandler() as ErrorRequestHandler;
}

/**
 * Express application extension to configure Treblle
 * @param options - Treblle configuration options
 */
export function configureTreblle(app: any, options: TreblleOptions): void {
  const treblle = new Treblle(options);
  
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
  const treblle = new Treblle(options);
  return treblle.middleware() as RequestHandler;
}

// Default export with all Express integration functions
export default {
  createTreblleMiddleware,
  createTreblleErrorHandler,
  configureTreblle,
  applyTreblleToRoutes
};