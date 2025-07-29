/**
 * @file src/integrations/nextjs.ts
 * @description Next.js App Router integration for Treblle SDK
 */

import Treblle from '../index';
import { TreblleOptions, TreblleError } from '../types';
import { maskSensitiveData } from '../masking';
import { 
  getServerIp,
  calculateResponseSize
} from '../utils';

// Store instances by config hash to avoid creating duplicate instances
const instances = new Map<string, Treblle>();

/**
 * Next.js Route Handler type
 */
export type NextRouteHandler<T = any> = 
  (request: Request, context: { params?: T }) => Response | Promise<Response>;

/**
 * Helper to get or create a Treblle instance based on config
 * @param options - Treblle configuration options
 * @returns Treblle instance
 */
function getTreblleInstance(options: TreblleOptions): Treblle {
  // Create a simple hash of the options object
  const hash = JSON.stringify({
    sdkToken: options.sdkToken,
    apiKey: options.apiKey,
    debug: options.debug,
    enabled: options.enabled,
    environments: options.environments,
    additionalMaskedFields: options.additionalMaskedFields,
    excludePaths: options.excludePaths,
    includePaths: options.includePaths
  });
  
  // Check if we already have an instance with these options
  if (!instances.has(hash)) {
    instances.set(hash, new Treblle(options));
  }
  
  return instances.get(hash)!;
}

/**
 * Helper to convert hrtime to microseconds
 * @param hrtime - High resolution time tuple
 * @returns Duration in microseconds
 */
function hrToMicro(hrtime: [number, number]): number {
  return hrtime[0] * 1000000 + hrtime[1] / 1000;
}

/**
 * Helper to extract client IP from Next.js Request
 * @param req - Next.js Request object
 * @returns Client IP address
 */
function getNextClientIp(req: Request): string {
  // Try headers in order of preference
  const headers = req.headers;
  
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Get the first IP from the comma-separated list
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const clientIp = headers.get('x-client-ip');
  if (clientIp) {
    return clientIp;
  }
  
  // Fallback to localhost
  return '127.0.0.1';
}

/**
 * Helper to extract route path from Next.js request
 * @param req - Next.js Request object
 * @param context - Route context with params
 * @returns Route path pattern
 */
function getNextRoutePath(req: Request, context?: { params?: any }): string {
  const url = new URL(req.url);
  let pathname = url.pathname;
  
  // If we have params, try to replace them with placeholders
  if (context?.params) {
    Object.entries(context.params).forEach(([key, value]) => {
      if (typeof value === 'string') {
        pathname = pathname.replace(new RegExp(`/${value}(?=/|$)`), `/{${key}}`);
      }
    });
  }
  
  return pathname;
}

/**
 * Helper to safely parse request body
 * @param req - Cloned Next.js Request object
 * @returns Parsed request body
 */
async function parseRequestBody(req: Request): Promise<any> {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await req.json();
    } else if (contentType.includes('multipart/form-data')) {
      // For file uploads, just indicate it's a file
      return { __type: 'file', contentType };
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const result: any = {};
      formData.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    } else {
      const text = await req.text();
      return text || {};
    }
  } catch (error) {
    // If parsing fails, return empty object
    return {};
  }
}

/**
 * Helper to safely parse response body
 * @param res - Cloned Next.js Response object
 * @returns Parsed response body
 */
async function parseResponseBody(res: Response): Promise<any> {
  try {
    const contentType = res.headers.get('content-type') || '';
    
    // Check if it's a file response
    const contentDisposition = res.headers.get('content-disposition') || '';
    const isFile = contentDisposition.includes('attachment') || 
                  contentDisposition.includes('filename') ||
                  contentType.includes('application/octet-stream') ||
                  contentType.includes('application/pdf') ||
                  contentType.includes('image/') ||
                  contentType.includes('audio/') ||
                  contentType.includes('video/');
                  
    if (isFile) {
      const contentLength = res.headers.get('content-length') || '0';
      return {
        __type: 'file',
        size: parseInt(contentLength, 10),
        contentType: contentType
      };
    }
    
    // Check if response body is readable (not consumed)
    if (!res.body) {
      return {};
    }
    
    if (contentType.includes('application/json')) {
      return await res.json();
    } else {
      const text = await res.text();
      if (!text) return {};
      
      // Try to parse as JSON in case content-type is wrong
      try {
        return JSON.parse(text);
      } catch {
        return { __type: 'text', content: text };
      }
    }
  } catch (error) {
    // If parsing fails or body is already consumed, return empty object
    return {};
  }
}

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
    
    // Check if this path should be excluded (reusing Treblle's internal logic)
    const shouldExclude = (treblle as any)._shouldExcludePath?.(pathname);
    const isIncluded = (treblle as any)._isPathIncluded?.(pathname);
    
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
      requestBody = await parseRequestBody(clonedReq);
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
      responseBody = await parseResponseBody(clonedRes);
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
    
    // Build the payload according to Treblle specification
    const payload = {
      api_key: options.sdkToken,
      project_id: options.apiKey,
      sdk: 'nodejs',
      version: '1.0.0',
      data: {
        server: {
          ip: getServerIp(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          os: {
            name: process.platform,
            release: process.release.name,
            architecture: process.arch
          },
          software: process.version,
          language: {
            name: "nodejs",
            version: process.version
          }
        },
        request: {
          timestamp: requestTimestamp,
          ip: getNextClientIp(request),
          url: request.url,
          route_path: routePath,
          user_agent: request.headers.get('user-agent') || '',
          method: request.method,
          headers: maskSensitiveData(requestHeaders, options.additionalMaskedFields),
          body: maskSensitiveData(requestBody, options.additionalMaskedFields)
        },
        response: {
          headers: maskSensitiveData(responseHeaders, options.additionalMaskedFields),
          code: response.status,
          size: calculateResponseSize(responseBody, { getHeader: (name: string) => response.headers.get(name) }),
          load_time: duration,
          body: maskSensitiveData(responseBody, options.additionalMaskedFields)
        },
        errors: errors
      }
    };
    
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
