/**
 * @file src/integrations/nextjs.ts
 * @description Next.js App Router integration for Treblle SDK
 */

import Treblle from '../index';
import { TreblleOptions, TreblleError } from '../types';
import { 
  hrToMicro,
  getNextClientIp,
  getNextRoutePath
} from '../utils';
import { 
  parseNextjsRequestBody, 
  parseNextjsResponseBody 
} from '../core/body-parsers';
import { 
  buildTrebllePayload,
  PayloadRequest,
  PayloadResponse
} from '../core/payload';
import { getTreblleInstance } from '../core/instance-manager';

/**
 * Next.js Route Handler type
 */
export type NextRouteHandler<T = any> = 
  (request: Request, context: { params?: T }) => Response | Promise<Response>;

/**
 * Creates a wrapped handler that monitors the request/response
 * @param treblle - Treblle instance
 * @param options - Treblle options
 * @param handler - The original route handler
 * @returns Wrapped handler
 */
function createWrappedHandler<T extends NextRouteHandler>(
  treblle: Treblle, 
  options: TreblleOptions, 
  handler: T
): T {
  return (async (request: Request, context: { params?: any }) => {
    // Check if SDK is enabled
    if (!treblle.options?.enabled && treblle.options?.enabled !== undefined) {
      return handler(request, context);
    }
    
    // Get the request path for filtering
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Check if this path should be excluded (using public methods)
    const shouldExclude = treblle.shouldExcludePath(pathname);
    const isIncluded = treblle.isPathIncluded(pathname);
    
    if (shouldExclude || !isIncluded) {
      return handler(request, context);
    }
    
    // Validate runtime (Next.js Edge runtime doesn't support process.hrtime)
    if (typeof process === 'undefined' || !process.hrtime) {
      if (options.debug) {
        console.warn('[Treblle SDK] Next.js Edge runtime is not supported. Use Node.js runtime.');
      }
      return handler(request, context);
    }
    
    // Start timing
    const requestStartTime = process.hrtime();
    const requestTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Clone request to read body without consuming it
    let requestBody: any = {};
    try {
      const clonedReq = request.clone();
      requestBody = await parseNextjsRequestBody(clonedReq);
    } catch (error) {
      if (options.debug) {
        console.warn('[Treblle SDK] Failed to parse request body:', error);
      }
    }
    
    // Execute the handler and capture errors
    let response: Response;
    const errors: TreblleError[] = [];
    
    try {
      response = await handler(request, context);
    } catch (err: unknown) {
      // Capture error for telemetry
      errors.push(treblle.formatError(err));
      
      if (options.debug) {
        console.error('[Treblle SDK] Handler threw error:', err);
      }
      
      // Re-throw to let Next.js handle it
      throw err;
    }
    
    // Calculate duration
    const hrDuration = process.hrtime(requestStartTime);
    const duration = hrToMicro(hrDuration);
    
    // Clone response to read body without consuming it
    let responseBody: any = {};
    try {
      const clonedRes = response.clone();
      responseBody = await parseNextjsResponseBody(clonedRes);
    } catch (error) {
      if (options.debug) {
        console.warn('[Treblle SDK] Failed to parse response body:', error);
      }
    }
    
    // Build headers objects
    const requestHeaders: Record<string, any> = {};
    request.headers.forEach((value, key) => {
      requestHeaders[key] = value;
    });
    
    const responseHeaders: Record<string, any> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Get route path
    const routePath = getNextRoutePath(request, context);
    
    // Build the payload using shared builder
    const payloadRequest: PayloadRequest = {
      timestamp: requestTimestamp,
      ip: getNextClientIp(request),
      url: request.url,
      route_path: routePath,
      user_agent: request.headers.get('user-agent') || '',
      method: request.method,
      headers: requestHeaders,
      body: requestBody
    };

    const payloadResponse: PayloadResponse = {
      headers: responseHeaders,
      code: response.status,
      size: 0, // Will be calculated by payload builder
      load_time: duration,
      body: responseBody
    };

    const payload = buildTrebllePayload({
      sdkToken: options.sdkToken,
      apiKey: options.apiKey,
      request: payloadRequest,
      response: payloadResponse,
      errors: errors,
      options: options,
      responseObject: { getHeader: (name: string) => response.headers.get(name) }
    });
    
    // Send telemetry asynchronously
    treblle.capture(payload);
    
    if (options.debug) {
      console.log(`[Treblle SDK] Next.js: Captured ${request.method} ${routePath} - ${response.status} (${duration}μs)`);
    }
    
    return response;
  }) as T;
}

/**
 * Creates a Treblle wrapper function for Next.js Route Handlers
 * @param options - Treblle configuration options
 * @returns Function to wrap route handlers
 */
export function withTreblle(options: TreblleOptions) {
  const treblle = getTreblleInstance(options);
  
  return function <T extends NextRouteHandler>(handler: T): T {
    return createWrappedHandler(treblle, options, handler);
  };
}

/**
 * Creates a reusable Treblle wrapper with pre-configured options
 * @param options - Treblle configuration options
 * @returns Reusable wrapper function
 */
export function createTreblleWrapper(options: TreblleOptions) {
  return withTreblle(options);
}

/**
 * Direct integration - wrap a single handler with options
 * @param handler - Route handler to wrap
 * @param options - Treblle configuration options
 * @returns Wrapped handler
 */
export function treblleHandler<T extends NextRouteHandler>(
  handler: T, 
  options: TreblleOptions
): T {
  const treblle = getTreblleInstance(options);
  return createWrappedHandler(treblle, options, handler);
}

// Default export with all Next.js integration functions
export default {
  withTreblle,
  createTreblleWrapper,
  treblleHandler
};
