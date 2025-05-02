/**
 * @file src/utils.ts
 * @description Utility functions for Treblle SDK
 */

import { TreblleOptions } from './types';
import os from 'os';

/**
 * @function getCurrentEnvironment
 * @description Detect the current environment
 * @returns Environment name
 */
export function getCurrentEnvironment(): string {
  // 1. Check NODE_ENV environment variable (most common)
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv) {
    return nodeEnv.toLowerCase();
  }
  
  // 2. Check for other common environment variables
  if (process.env.APP_ENV) {
    return process.env.APP_ENV.toLowerCase();
  }
  
  if (process.env.ENVIRONMENT) {
    return process.env.ENVIRONMENT.toLowerCase();
  }
  
  // 3. Check for cloud provider environment variables
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV.toLowerCase();
  }
  
  if (process.env.HEROKU_ENVIRONMENT) {
    return process.env.HEROKU_ENVIRONMENT.toLowerCase();
  }
  
  // 4. Check framework-specific environment variables
  if (process.env.NEXT_PUBLIC_ENV) {
    return process.env.NEXT_PUBLIC_ENV.toLowerCase();
  }
  
  // 5. Check common cloud environment indicators
  if (process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return 'production'; // Assume AWS Lambda is production unless otherwise specified
  }
  
  if (process.env.AZURE_FUNCTIONS_ENVIRONMENT) {
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
        return config.environments.enabled.includes(currentEnv);
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
 * @param req - Express request object
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
}

/**
 * @function calculateResponseSize
 * @description Calculate the size of the response in bytes
 * @param body - Response body
 * @param res - Express response object
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
 * @description Extract the route path pattern from the request
 * @param req - Express request object
 * @returns Route path pattern or empty string if not available
 */
export function extractRoutePath(req: any): string {
  // Just use Express route path which contains the parameter pattern
  // This covers the most common case and is the most reliable method
  if (req.route && req.route.path) {
    return req.route.path;
  }
  
  // If route information isn't available, return an empty string
  // This is better than guessing as it clearly indicates no route path was found
  return '';
}