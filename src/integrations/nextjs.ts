/**
 * @file src/integrations/nextjs.ts
 * @description Comprehensive Next.js integration for Treblle SDK
 * Supports App Router, Pages Router, middleware, dynamic routes, edge runtime, and streaming
 */

import Treblle from '../index';
import { TreblleOptions, TreblleError } from '../types';
import { 
  hrToMicro,
  getNextClientIp
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
import type { NextRequest, NextResponse } from 'next/server';

// ===== TYPES AND INTERFACES =====

/**
 * App Router Route Handler type
 */
export type NextRouteHandler<T = any> = 
  (request: Request, context: { params?: T }) => Response | Promise<Response>;

/**
 * Pages Router API Handler type  
 */
export type NextApiHandler<T = any> = 
  (req: any, res: any) => T | Promise<T>;

/**
 * Next.js Middleware Handler type
 */
export type NextMiddlewareHandler = 
  (request: NextRequest) => NextResponse | Promise<NextResponse>;

/**
 * Route context with enhanced params support
 */
export interface NextRouteContext {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string>;
}

/**
 * Enhanced configuration for NextJS integration
 */
export interface NextjsTreblleOptions extends TreblleOptions {
  /**
   * Enable Edge Runtime support (limited functionality)
   */
  enableEdgeRuntime?: boolean;
  
  /**
   * Handle streaming responses
   */
  handleStreaming?: boolean;
  
  /**
   * Custom route path extraction function
   */
  routeExtractor?: (request: Request, context?: NextRouteContext) => string;
  
  /**
   * Maximum body size to process (default: 2MB)
   */
  maxBodySize?: number;
  
  /**
   * Environment-specific settings
   */
  nextjsEnv?: {
    /**
     * Respect Next.js caching mechanisms
     */
    respectCaching?: boolean;
    
    /**
     * Handle ISR (Incremental Static Regeneration)
     */
    handleISR?: boolean;
  };
}

/**
 * Middleware configuration for specific paths
 */
export interface MiddlewareConfig {
  /**
   * Paths to match for this middleware
   */
  matcher?: string | string[] | {
    source: string;
    has?: Array<{
      type: 'header' | 'query' | 'cookie';
      key: string;
      value?: string;
    }>;
    missing?: Array<{
      type: 'header' | 'query' | 'cookie';
      key: string;
      value?: string;
    }>;
  }[];
}

// ===== DEFAULT BLOCKED PATHS =====

/**
 * Default paths that should be blocked from Treblle monitoring
 * These are common static assets and system files that don't need tracking
 */
export const DefaultBlockedPaths = [
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'sitemap.txt',
  'ads.txt',
  'security.txt',
  'manifest.json',
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
  'browserconfig.xml',
  'humans.txt',
  'opensearch.xml',
  'sw.js',
  'service-worker.js',
  'workbox-sw.js'
];

/**
 * Default patterns that should be blocked from Treblle monitoring
 * These cover file extensions and path patterns for static assets
 */
export const DefaultBlockedPatterns = [
  // Image files
  /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff)$/i,
  
  // Static assets
  /\.(css|js|woff|woff2|ttf|eot|otf|map)$/i,
  
  // Documents and media
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz)$/i,
  /\.(mp3|mp4|wav|avi|mov|wmv|flv|webm)$/i,
  
  // Static directories
  /^\/_next\//i,
  /^\/static\//i,
  /^\/public\//i,
  /^\/assets\//i,
  /^\/images\//i,
  /^\/css\//i,
  /^\/js\//i,
  /^\/fonts\//i,
  
  // System and meta paths
  /^\/.well-known\//i,
  /^\/apple-touch-icon/i,
  /^\/mstile-/i,
  /^\/favicon/i
];

// ===== UTILITY FUNCTIONS =====

/**
 * Check if a path should be blocked by default Next.js blocking rules
 * @param pathname - The pathname to check
 * @returns true if the path should be blocked
 */
function isDefaultBlockedPath(pathname: string): boolean {
  // Remove leading slash and normalize
  const normalizedPath = pathname.replace(/^\/+/, '');
  
  // Check exact path matches
  if (DefaultBlockedPaths.includes(normalizedPath)) {
    return true;
  }
  
  // Check pattern matches
  return DefaultBlockedPatterns.some(pattern => pattern.test(pathname));
}

/**
 * Enhanced route path extraction for Next.js
 */
function extractNextRoute(request: Request, context?: NextRouteContext): string {
  const url = new URL(request.url);
  let pathname = url.pathname;
  
  // Remove /api prefix if present
  if (pathname.startsWith('/api/')) {
    pathname = pathname.substring(4);
  }
  
  // Handle dynamic routes using context.params
  if (context?.params) {
    for (const [key, value] of Object.entries(context.params)) {
      if (Array.isArray(value)) {
        // Catch-all routes [...slug]
        const slugPath = value.join('/');
        pathname = pathname.replace(slugPath, `[...${key}]`);
      } else {
        // Regular dynamic routes [id]
        pathname = pathname.replace(String(value), `[${key}]`);
      }
    }
  }
  
  // Handle route groups - extract from pathname
  const routeGroupMatch = pathname.match(/\/\([^)]+\)/g);
  if (routeGroupMatch) {
    // Keep route groups in the path for better organization
    return pathname;
  }
  
  return pathname;
}

/**
 * Check if the request path matches middleware configuration
 */
function matchesMiddlewareConfig(request: NextRequest, config?: MiddlewareConfig): boolean {
  if (!config?.matcher) {
    return true;
  }
  
  const pathname = request.nextUrl.pathname;
  const matchers = Array.isArray(config.matcher) ? config.matcher : [config.matcher];
  
  return matchers.some(matcher => {
    if (typeof matcher === 'string') {
      const pattern = matcher.replace(/\*/g, '.*').replace(/\?/g, '\\?');
      return new RegExp(`^${pattern}$`).test(pathname);
    } else {
      const sourcePattern = matcher.source.replace(/\*/g, '.*').replace(/\?/g, '\\?');
      
      if (!new RegExp(`^${sourcePattern}$`).test(pathname)) {
        return false;
      }
      
      // Check 'has' conditions
      if (matcher.has) {
        const hasConditionsMet = matcher.has.every(condition => {
          switch (condition.type) {
            case 'header':
              const headerValue = request.headers.get(condition.key);
              return headerValue && (condition.value ? headerValue === condition.value : true);
            case 'query':
              const queryValue = request.nextUrl.searchParams.get(condition.key);
              return queryValue && (condition.value ? queryValue === condition.value : true);
            case 'cookie':
              const cookieValue = request.cookies.get(condition.key)?.value;
              return cookieValue && (condition.value ? cookieValue === condition.value : true);
            default:
              return false;
          }
        });
        
        if (!hasConditionsMet) {
          return false;
        }
      }
      
      // Check 'missing' conditions
      if (matcher.missing) {
        const missingConditionsMet = matcher.missing.every(condition => {
          switch (condition.type) {
            case 'header':
              const headerValue = request.headers.get(condition.key);
              return !headerValue || (condition.value ? headerValue !== condition.value : false);
            case 'query':
              const queryValue = request.nextUrl.searchParams.get(condition.key);
              return !queryValue || (condition.value ? queryValue !== condition.value : false);
            case 'cookie':
              const cookieValue = request.cookies.get(condition.key)?.value;
              return !cookieValue || (condition.value ? cookieValue !== condition.value : false);
            default:
              return false;
          }
        });
        
        if (!missingConditionsMet) {
          return false;
        }
      }
      
      return true;
    }
  });
}

/**
 * Check if running in Edge Runtime
 */
function isEdgeRuntime(): boolean {
  return (typeof (globalThis as any).EdgeRuntime !== 'undefined') || 
         (typeof process === 'undefined') ||
         (typeof process.hrtime !== 'function');
}

/**
 * Edge-compatible timing utility
 */
function getElapsedTime(startTime: number | [number, number]): number {
  if (isEdgeRuntime()) {
    return (performance.now() - (startTime as number)) * 1000; // Convert to microseconds
  } else {
    const hrDuration = process.hrtime(startTime as [number, number]);
    return hrToMicro(hrDuration);
  }
}

/**
 * Start timing for both Node.js and Edge runtime
 */
function startTiming(): number | [number, number] {
  if (isEdgeRuntime()) {
    return performance.now();
  } else {
    return process.hrtime();
  }
}

// ===== CORE WRAPPER FUNCTIONS =====

/**
 * Creates a wrapped App Router handler that monitors the request/response
 */
function createWrappedAppRouterHandler<T extends NextRouteHandler>(
  treblle: Treblle, 
  options: NextjsTreblleOptions, 
  handler: T
): T {
  return (async (request: Request, context: { params?: any }) => {
    // Check if SDK is enabled (environment-aware)
    const enabled = (typeof (treblle as any).isEnabled === 'function')
      ? (treblle as any).isEnabled()
      : options.enabled !== false;
    if (!enabled) {
      return handler(request, context);
    }
    
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Check path filtering (including default blocked paths)
    if (isDefaultBlockedPath(pathname) || treblle.shouldExcludePath(pathname) || !treblle.isPathIncluded(pathname)) {
      return handler(request, context);
    }
    
    // Handle Edge Runtime limitations
    if (isEdgeRuntime() && !options.enableEdgeRuntime) {
      if (options.debug) {
        console.warn('[Treblle SDK] Edge runtime detected but not enabled. Set enableEdgeRuntime: true');
      }
      return handler(request, context);
    }
    
    // Start timing
    const requestStartTime = startTiming();
    const requestTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Parse request body
    let requestBody: any = {};
    try {
      const clonedReq = request.clone();
      requestBody = await parseNextjsRequestBody(clonedReq);
      
      // Handle large bodies
      if (options.maxBodySize && JSON.stringify(requestBody).length > options.maxBodySize) {
        requestBody = {
          __type: 'large_body',
          size: JSON.stringify(requestBody).length,
          message: 'Request body too large to process'
        };
      }
    } catch (error) {
      if (options.debug) {
        console.warn('[Treblle SDK] Failed to parse request body:', error);
      }
    }
    
    // Execute handler and capture errors
    let response: Response;
    const errors: TreblleError[] = [];
    
    try {
      response = await handler(request, context);
    } catch (err: unknown) {
      errors.push(treblle.formatError(err));
      
      if (options.debug) {
        console.error('[Treblle SDK] Handler threw error:', err);
      }
      
      throw err;
    }
    
    // Calculate duration
    const duration = getElapsedTime(requestStartTime);
    
    // Parse response body
    let responseBody: any = {};
    try {
      // Handle streaming responses
      if (options.handleStreaming && 
          (response.headers.get('transfer-encoding') === 'chunked' || 
           response.headers.get('content-type')?.includes('stream'))) {
        responseBody = {
          __type: 'stream',
          contentType: response.headers.get('content-type'),
          transferEncoding: response.headers.get('transfer-encoding')
        };
      } else {
        const clonedRes = response.clone();
        responseBody = await parseNextjsResponseBody(clonedRes);
        
        // Handle large responses
        if (options.maxBodySize && JSON.stringify(responseBody).length > options.maxBodySize) {
          responseBody = {
            __type: 'large_response',
            size: JSON.stringify(responseBody).length,
            message: 'Response body too large to process'
          };
        }
      }
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

    // Build query object (string values, join duplicates with comma)
    const urlObj = new URL(request.url);
    const query: Record<string, string> = {};
    for (const key of urlObj.searchParams.keys()) {
      const all = urlObj.searchParams.getAll(key);
      query[key] = all.join(',');
    }
    
    const responseHeaders: Record<string, any> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    // Get route path
    const routePath = options.routeExtractor ? 
      options.routeExtractor(request, context) :
      extractNextRoute(request, context);
    
    // Build payload
    const payloadRequest: PayloadRequest = {
      timestamp: requestTimestamp,
      ip: getNextClientIp(request),
      url: request.url,
      route_path: routePath,
      user_agent: request.headers.get('user-agent') || '',
      method: request.method,
      headers: requestHeaders,
      query,
      body: requestBody
    };

    const payloadResponse: PayloadResponse = {
      headers: responseHeaders,
      code: response.status,
      size: 0,
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
 * Creates a wrapped Pages Router handler
 */
function createWrappedPagesHandler<T extends NextApiHandler>(
  treblle: Treblle,
  options: NextjsTreblleOptions,
  handler: T
): T {
  return (async (req: any, res: any) => {
    // Check if SDK is enabled (environment-aware)
    const enabled = (typeof (treblle as any).isEnabled === 'function')
      ? (treblle as any).isEnabled()
      : options.enabled !== false;
    if (!enabled) {
      return handler(req, res);
    }
    
    const pathname = req.url || '';
    
    // Check path filtering (including default blocked paths)
    if (isDefaultBlockedPath(pathname) || treblle.shouldExcludePath(pathname) || !treblle.isPathIncluded(pathname)) {
      return handler(req, res);
    }
    
    // Start timing
    const requestStartTime = startTiming();
    const requestTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Capture request data
    const requestBody = req.body || {};
    const requestHeaders = req.headers || {};
    // Build query (Next.js Pages: req.query may contain arrays)
    const query: Record<string, string> = {};
    if (req.query) {
      Object.keys(req.query).forEach((k) => {
        const v = (req.query as any)[k];
        if (Array.isArray(v)) query[k] = v.join(',');
        else if (v === undefined || v === null) query[k] = '';
        else query[k] = String(v);
      });
    }
    
    // Execute handler and capture errors
    const errors: TreblleError[] = [];
    let originalJson = res.json;
    let originalSend = res.send;
    let originalEnd = res.end;
    let responseBody: any = {};
    let responseSent = false;
    
    // Intercept response methods
    res.json = function(data: any) {
      if (!responseSent) {
        responseBody = data;
        responseSent = true;
      }
      return originalJson.call(this, data);
    };
    
    res.send = function(data: any) {
      if (!responseSent) {
        responseBody = data;
        responseSent = true;
      }
      return originalSend.call(this, data);
    };
    
    res.end = function(data?: any) {
      if (!responseSent && data) {
        responseBody = data;
        responseSent = true;
      }
      return originalEnd.call(this, data);
    };
    
    try {
      const result = await handler(req, res);
      
      // Calculate duration
      const duration = getElapsedTime(requestStartTime);
      
      // Build payload
      const payloadRequest: PayloadRequest = {
        timestamp: requestTimestamp,
        ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        url: `http://localhost:3000${req.url}`,
        route_path: pathname,
        user_agent: req.headers['user-agent'] || '',
        method: req.method,
        headers: requestHeaders,
        query,
        body: requestBody
      };

      const payloadResponse: PayloadResponse = {
        headers: res.getHeaders ? res.getHeaders() : {},
        code: res.statusCode || 200,
        size: 0,
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
        responseObject: res
      });
      
      // Send telemetry asynchronously
      treblle.capture(payload);
      
      if (options.debug) {
        console.log(`[Treblle SDK] Next.js Pages: Captured ${req.method} ${pathname} - ${res.statusCode} (${duration}μs)`);
      }
      
      return result;
    } catch (err: unknown) {
      errors.push(treblle.formatError(err));
      
      if (options.debug) {
        console.error('[Treblle SDK] Pages handler threw error:', err);
      }
      
      throw err;
    }
  }) as T;
}

/**
 * Creates a wrapped middleware handler
 */
function createWrappedMiddleware(
  treblle: Treblle,
  options: NextjsTreblleOptions,
  middleware: NextMiddlewareHandler,
  config?: MiddlewareConfig
): NextMiddlewareHandler {
  return async (request: NextRequest) => {
    // Check if SDK is enabled (environment-aware)
    const enabled = (typeof (treblle as any).isEnabled === 'function')
      ? (treblle as any).isEnabled()
      : options.enabled !== false;
    if (!enabled) {
      return middleware(request);
    }
    
    // Check if this request matches our configuration
    if (!matchesMiddlewareConfig(request, config)) {
      return middleware(request);
    }
    
    const pathname = request.nextUrl.pathname;
    
    // Check path filtering (including default blocked paths)
    if (isDefaultBlockedPath(pathname) || treblle.shouldExcludePath(pathname) || !treblle.isPathIncluded(pathname)) {
      return middleware(request);
    }
    
    // Start timing
    const requestStartTime = startTiming();
    const requestTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Parse request body (limited in middleware)
    let requestBody: any = {};
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const clonedReq = request.clone();
        requestBody = await parseNextjsRequestBody(clonedReq);
      }
    } catch (error) {
      if (options.debug) {
        console.warn('[Treblle SDK] Failed to parse middleware request body:', error);
      }
    }
    
    // Execute middleware and capture errors
    let response: NextResponse;
    const errors: TreblleError[] = [];
    
    try {
      response = await middleware(request);
    } catch (err: unknown) {
      errors.push(treblle.formatError(err));
      
      if (options.debug) {
        console.error('[Treblle SDK] Middleware threw error:', err);
      }
      
      throw err;
    }
    
    // Calculate duration
    const duration = getElapsedTime(requestStartTime);
    
    // Build headers objects
    const requestHeaders: Record<string, any> = {};
    request.headers.forEach((value, key) => {
      requestHeaders[key] = value;
    });
    
    const responseHeaders: Record<string, any> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Build query object
    const query: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      if (query[key]) {
        query[key] = `${query[key]},${value}`;
      } else {
        query[key] = value;
      }
    });
    
    // Build payload
    const payloadRequest: PayloadRequest = {
      timestamp: requestTimestamp,
      ip: getNextClientIp(request),
      url: request.url,
      route_path: pathname,
      user_agent: request.headers.get('user-agent') || '',
      method: request.method,
      headers: requestHeaders,
      query,
      body: requestBody
    };

    const payloadResponse: PayloadResponse = {
      headers: responseHeaders,
      code: response.status,
      size: 0,
      load_time: duration,
      body: {} // Middleware typically doesn't have response bodies
    };

    const payload = buildTrebllePayload({
      sdkToken: options.sdkToken,
      apiKey: options.apiKey,
      request: payloadRequest,
      response: payloadResponse,
      errors: errors,
      options: options,
      responseObject: { 
        getHeader: (name: string) => response.headers.get(name),
        statusCode: response.status
      }
    });
    
    // Send telemetry asynchronously
    treblle.capture(payload);
    
    if (options.debug) {
      console.log(`[Treblle SDK] Next.js Middleware: Captured ${request.method} ${pathname} - ${response.status} (${duration}μs)`);
    }
    
    return response;
  };
}

// ===== PUBLIC API =====

/**
 * Main wrapper function for Next.js App Router
 * @param options - Treblle configuration options
 * @returns Function to wrap route handlers
 */
export function withTreblle(options: NextjsTreblleOptions) {
  const treblle = getTreblleInstance(options);
  
  return function <T extends NextRouteHandler>(handler: T): T {
    return createWrappedAppRouterHandler(treblle, options, handler);
  };
}

/**
 * Wrapper for Next.js Pages Router API routes
 * @param options - Treblle configuration options
 * @returns Function to wrap API handlers
 */
export function withTrebllePages(options: NextjsTreblleOptions) {
  const treblle = getTreblleInstance(options);
  
  return function <T extends NextApiHandler>(handler: T): T {
    return createWrappedPagesHandler(treblle, options, handler);
  };
}

/**
 * Wrapper for Next.js middleware
 * @param options - Treblle configuration options
 * @param config - Optional middleware configuration
 * @returns Function to wrap middleware
 */
export function withTreblleMiddleware(
  options: NextjsTreblleOptions,
  config?: MiddlewareConfig
) {
  const treblle = getTreblleInstance(options);
  
  return function (middleware: NextMiddlewareHandler): NextMiddlewareHandler {
    return createWrappedMiddleware(treblle, options, middleware, config);
  };
}

/**
 * Enhanced wrapper with production features
 * @param options - Enhanced Treblle configuration options
 * @returns Object with handler methods for different Next.js patterns
 */
export function createTreblleWrapper(options: NextjsTreblleOptions) {
  const treblle = getTreblleInstance(options);
  
  return {
    /**
     * Wrap App Router handlers
     */
    handler: <T extends NextRouteHandler>(handler: T): T => {
      return createWrappedAppRouterHandler(treblle, options, handler);
    },
    
    /**
     * Wrap Pages Router handlers
     */
    pagesHandler: <T extends NextApiHandler>(handler: T): T => {
      return createWrappedPagesHandler(treblle, options, handler);
    },
    
    /**
     * Wrap middleware
     */
    middleware: (middleware: NextMiddlewareHandler, config?: MiddlewareConfig): NextMiddlewareHandler => {
      return createWrappedMiddleware(treblle, options, middleware, config);
    }
  };
}

/**
 * Direct integration - wrap a single App Router handler with options
 * @param handler - Route handler to wrap
 * @param options - Treblle configuration options
 * @returns Wrapped handler
 */
export function treblleHandler<T extends NextRouteHandler>(
  handler: T, 
  options: NextjsTreblleOptions
): T {
  const treblle = getTreblleInstance(options);
  return createWrappedAppRouterHandler(treblle, options, handler);
}

/**
 * Direct integration - wrap a single Pages Router handler with options
 * @param handler - API handler to wrap
 * @param options - Treblle configuration options
 * @returns Wrapped handler
 */
export function treblleApiHandler<T extends NextApiHandler>(
  handler: T,
  options: NextjsTreblleOptions
): T {
  const treblle = getTreblleInstance(options);
  return createWrappedPagesHandler(treblle, options, handler);
}

/**
 * Create middleware wrapper function
 * @param options - Treblle configuration options
 * @returns Middleware wrapper function
 */
export function createMiddlewareWrapper(options: NextjsTreblleOptions) {
  return withTreblleMiddleware(options);
}

// ===== BACKWARD COMPATIBILITY =====

/**
 * Alias for withTreblle for backward compatibility
 */
export const createTreblleHandler = withTreblle;

// ===== DEFAULT EXPORT =====

export default {
  // Main functions
  withTreblle,
  withTrebllePages,
  withTreblleMiddleware,
  createTreblleWrapper,
  createMiddlewareWrapper,
  
  // Direct integration functions
  treblleHandler,
  treblleApiHandler,
  
  // Backward compatibility
  createTreblleHandler
};
