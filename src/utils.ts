/**
 * @file src/utils.ts
 * @description Utility functions for Treblle SDK
 */

import { TreblleOptions } from './types';

/**
 * @function getCurrentEnvironment
 * @description Detect the current environment
 * @returns Environment name
 */
export function getCurrentEnvironment(): string {
  // Guard for Edge runtime where process may be undefined
  const hasProcess = typeof process !== 'undefined' && typeof process.env !== 'undefined';

  // 1. Check NODE_ENV environment variable (most common)
  if (hasProcess) {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv) {
      return nodeEnv.toLowerCase();
    }
  }
  
  // 2. Check for other common environment variables
  if (hasProcess && process.env.APP_ENV) {
    return process.env.APP_ENV.toLowerCase();
  }
  
  if (hasProcess && process.env.ENVIRONMENT) {
    return process.env.ENVIRONMENT.toLowerCase();
  }
  
  // 3. Check for cloud provider environment variables
  if (hasProcess && process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV.toLowerCase();
  }
  
  if (hasProcess && process.env.HEROKU_ENVIRONMENT) {
    return process.env.HEROKU_ENVIRONMENT.toLowerCase();
  }
  
  // 4. Check framework-specific environment variables
  if (hasProcess && process.env.NEXT_PUBLIC_ENV) {
    return process.env.NEXT_PUBLIC_ENV.toLowerCase();
  }
  
  // 5. Check common cloud environment indicators
  if (hasProcess && (process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
    return 'production'; // Assume AWS Lambda is production unless otherwise specified
  }
  
  if (hasProcess && process.env.AZURE_FUNCTIONS_ENVIRONMENT) {
    return process.env.AZURE_FUNCTIONS_ENVIRONMENT.toLowerCase();
  }
  
  // Default to development if no environment is detected
  return 'development';
}

/**
 * @function isEnabledForEnvironment
 * @description Determine if the SDK should be enabled for the current environment
 * @param config - Configuration object
 * @returns Whether the SDK should be enabled
 */
export function isEnabledForEnvironment(config: TreblleOptions): boolean {
  // If explicitly enabled/disabled via config, respect that setting
  if (typeof config.enabled === 'boolean') {
    return config.enabled;
  }
  
  // Get current environment
  const currentEnv = getCurrentEnvironment();
  
  // Check environment-specific settings
  if (config.environments) {
    // If it's an object with specific settings
    if (typeof config.environments === 'object') {
      // Check if current environment is in the disabled list
      if (Array.isArray(config.environments.disabled) && 
          config.environments.disabled.includes(currentEnv)) {
        return false;
      }
      
      // Check if current environment is in the enabled list
      if (Array.isArray(config.environments.enabled) && 
          config.environments.enabled.length > 0) {
        // If environment is in enabled list, return true
        if (config.environments.enabled.includes(currentEnv)) {
          return true;
        }
        // If environment is not in enabled list, use default (false if not specified)
        return config.environments.default === true;
      }
      
      // If environment is not explicitly listed in either, use the default
      return config.environments.default !== false;
    }
    
    // If it's a boolean, use it directly
    if (typeof config.environments === 'boolean') {
      return config.environments;
    }
  }
  
  // Default to enabled for all environments
  return true;
}

/**
 * @function getClientIp
 * @description Gets the client IP address
 * @param req - Request object
 * @returns Client IP address
 */
export function getClientIp(req: any): string {
  return req.headers['x-forwarded-for'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.connection?.socket?.remoteAddress || 
         '127.0.0.1';
}

/**
 * @function getServerIp
 * @description Gets the server IP address
 * @returns Server IP address
 */
export function getServerIp(): string {
  // Edge/runtime-safe: avoid importing 'os' at module load
  try {
    // If process is not available (Edge), return loopback
    if (typeof process === 'undefined') {
      return '127.0.0.1';
    }
    // Lazily require 'os' only in Node runtimes
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const networkInterface = interfaces[name];
      if (networkInterface) {
        for (const iface of networkInterface) {
          // Skip internal and non-IPv4 addresses
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }
    return '127.0.0.1';
  } catch (_e) {
    return '127.0.0.1';
  }
}

/**
 * @function calculateResponseSize
 * @description Calculate the size of the response in bytes
 * @param body - Response body
 * @param res - Response object
 * @returns Size in bytes
 */
export function calculateResponseSize(body: any, res: any): number {
  try {
    // If Content-Length header is available, use it
    if (res && res.getHeader && res.getHeader('content-length')) {
      return parseInt(res.getHeader('content-length') as string, 10);
    }
    
    // If body is a file or binary placeholder, use the size if available
    if (body && typeof body === 'object' && 
        (body.__type === 'file' || body.__type === 'binary') && 
        body.size) {
      return body.size;
    }
    
    // For empty or null body
    if (!body) return 0;
    
    // For string bodies
    if (typeof body === 'string') {
      return Buffer.byteLength(body, 'utf8');
    }
    
    // For objects, convert to JSON string and measure
    if (typeof body === 'object') {
      const jsonString = JSON.stringify(body);
      return Buffer.byteLength(jsonString, 'utf8');
    }
    
    // Default for other types
    return 0;
  } catch (error) {
    // Silently handle errors and return 0
    return 0;
  }
}

/**
 * @function extractRoutePath
 * @description Extract the route path pattern from the request - NextJS only
 * @param req - Request object
 * @returns Route path pattern or original URL path if route not available
 */
export function extractRoutePath(req: any): string {
  // For NextJS applications - simplified version
  if (req.originalUrl || req.url) {
    const urlPath = (req.originalUrl || req.url).split('?')[0];
    return urlPath;
  }
  
  // If all else fails, return empty string
  return '';
}

/**
 * @function hrToMicro
 * @description Helper to convert hrtime to microseconds
 * @param hrtime - High resolution time tuple
 * @returns Duration in microseconds
 */
export function hrToMicro(hrtime: [number, number]): number {
  return hrtime[0] * 1000000 + hrtime[1] / 1000;
}

/**
 * @function getNextClientIp
 * @description Helper to extract client IP from Next.js Request
 * @param req - Next.js Request object
 * @returns Client IP address
 */
export function getNextClientIp(req: Request): string {
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
 * @function getNextRoutePath
 * @description Helper to extract route path from Next.js request
 * @param req - Next.js Request object
 * @param context - Route context with params
 * @returns Route path pattern
 */
export function getNextRoutePath(req: Request, context?: { params?: any }): string {
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
