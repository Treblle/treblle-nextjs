/**
 * @file src/index.ts
 * @description Main entry point for the Treblle SDK
 * @version 1.0.0
 */

import { TreblleOptions, TreblleError } from './types';
import { maskSensitiveData } from './masking';
import { 
  getCurrentEnvironment, 
  isEnabledForEnvironment, 
  getClientIp, 
  getServerIp,
  calculateResponseSize, 
  extractRoutePath
} from './utils';
import https from 'https';

// Constants
const TREBLLE_ENDPOINTS = [
  'https://rocknrolla.treblle.com',
  'https://punisher.treblle.com',
  'https://sicario.treblle.com'
];

// Import integrations for re-export
import * as expressIntegration from './integrations/express';
import * as nestjsIntegration from './integrations/nestjs';

/**
 * @class Treblle
 * @description Main SDK class for Treblle integration
 */
class Treblle {
  private sdkToken: string = '';
  // @ts-ignore: Used in payload construction
  private apiKey: string = '';
  private debug: boolean = false;
  private excludePaths: (string | RegExp)[] = [];
  private includePaths: (string | RegExp)[] = [];
  private enabled: boolean = true;
  private options!: TreblleOptions;

  /**
   * @constructor
   * @param options - Configuration options
   */
  constructor(options: TreblleOptions) {
    // Validate required configuration
    if (!options.sdkToken) {
      this._handleError(new Error('Treblle SDK requires an SDK token'));
      return;
    }

    if (!options.apiKey) {
      this._handleError(new Error('Treblle SDK requires an API key'));
      return;
    }

    this.options = options; // Store options for later use
    this.sdkToken = options.sdkToken;
    this.apiKey = options.apiKey;
    this.debug = options.debug || false;
    
    // Initialize path filters
    this.excludePaths = options.excludePaths || [];
    this.includePaths = options.includePaths || [];
    
    // Determine if the SDK should be enabled based on environment
    this.enabled = isEnabledForEnvironment(options);
    
    if (this.debug) {
      console.log(`[Treblle SDK] Initialized in ${getCurrentEnvironment()} environment. SDK ${this.enabled ? 'enabled' : 'disabled'}.`);
    }
  }

  /**
   * @method middleware
   * @description Express middleware to monitor API requests
   * @returns Express middleware function
   */
  middleware() {
    const self = this; // Store reference to this for use in callbacks
    return (req: any, res: any, next: any) => {
      // Skip if SDK is disabled for this environment
      if (!this.enabled) {
        return next();
      }
      
      // Get the request path for filtering
      const path = req.originalUrl || req.url;
      
      // Check if this path should be excluded
      if (this._shouldExcludePath(path)) {
        return next();
      }
      
      // Check if includePaths is specified and this path is not included
      if (this.includePaths.length > 0 && !this._isPathIncluded(path)) {
        return next();
      }
      
      // Store original timestamp when request started
      const requestStartTime = process.hrtime();
      const requestTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      // Capture the route path pattern
      // Store route_path on the request for later use
      req._treblleRoutePath = extractRoutePath(req);
      
      // Initialize error array
      res._treblleErrors = [];
      
      // Get original methods to intercept
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;
      
      // Store request body
      const requestBody = { ...req.body };
      let responseBody = {};
      
      // Override response methods to capture data
      res.send = function(body: any) {
        // Store body directly, will be processed later
        responseBody = body;
        return originalSend.apply(res, arguments);
      };
      
      res.json = function(body: any) {
        // For json responses, store the raw object directly
        responseBody = body;
        return originalJson.apply(res, arguments);
      };
      
      res.end = function(chunk: any, _encoding?: string) {
        // Calculate request duration
        const hrDuration = process.hrtime(requestStartTime);
        //const duration = hrDuration[0] * 1000 + hrDuration[1] / 1000000; // Convert to milliseconds
        const duration = hrDuration[0] * 1000000 + hrDuration[1] / 1000; // Convert to microseconds
        
        // Process response body
        if (chunk && typeof chunk !== 'function' && Object.keys(responseBody).length === 0) {
          try {
            // Try to parse as JSON
            if (typeof chunk === 'string') {
              try {
                // Parse string to get actual object
                responseBody = JSON.parse(chunk);
              } catch (e) {
                // If it's not valid JSON, keep as string
                responseBody = { __type: 'text', content: chunk };
              }
            } else if (Buffer.isBuffer(chunk)) {
              // Try to parse buffer as JSON
              try {
                const stringChunk = chunk.toString('utf8');
                responseBody = JSON.parse(stringChunk);
              } catch (e) {
                // Not JSON, mark as binary
                responseBody = { __type: 'binary', size: chunk.length };
              }
            } else if (typeof chunk === 'object') {
              // If it's already an object, use it directly - don't stringify
              responseBody = chunk;
            }
          } catch (e) {
            // Not valid JSON, use empty object
            responseBody = { __type: 'non-json' };
          }
        }
        
        // Check if response is a file or large binary data
        const contentType = res.getHeader ? (res.getHeader('content-type') || '') : '';
        const contentDisposition = res.getHeader ? (res.getHeader('content-disposition') || '') : '';
        
        // Check if response is a file or non-JSON content
        const isFile = contentDisposition.toString().includes('attachment') || 
                      contentDisposition.toString().includes('filename') ||
                      contentType.toString().includes('application/octet-stream') ||
                      contentType.toString().includes('application/pdf') ||
                      contentType.toString().includes('image/') ||
                      contentType.toString().includes('audio/') ||
                      contentType.toString().includes('video/');
                      
        const isJSON = contentType.toString().includes('application/json');
        
        // If it's a file or binary response, don't track the actual body
        if (isFile || (typeof responseBody === 'object' && responseBody && 
            '__type' in responseBody && responseBody.__type === 'binary')) {
          const contentLength = res.getHeader ? (res.getHeader('content-length') || 0) : 0;
          responseBody = {
            __type: 'file',
            size: contentLength,
            contentType: contentType
          };
        } else if (!isJSON && typeof responseBody === 'object' && responseBody && 
                  '__type' in responseBody && responseBody.__type === 'non-json') {
          // For non-JSON responses, store empty object
          responseBody = {};
        }
        
        // Check request body for files and handle appropriately
        if (req.files || (req.file && req.file.buffer)) {
          const processedRequestBody = { ...requestBody };
          
          // Handle multer single file upload
          if (req.file && req.file.buffer) {
            processedRequestBody[req.file.fieldname] = {
              __type: 'file',
              filename: req.file.originalname,
              size: req.file.size,
              mimetype: req.file.mimetype
            };
          }
          
          // Handle multer multiple file upload
          if (req.files) {
            Object.keys(req.files).forEach(fieldname => {
              const files = req.files[fieldname];
              if (Array.isArray(files)) {
                processedRequestBody[fieldname] = files.map(file => ({
                  __type: 'file',
                  filename: file.originalname,
                  size: file.size,
                  mimetype: file.mimetype
                }));
              } else {
                processedRequestBody[fieldname] = {
                  __type: 'file',
                  filename: files.originalname,
                  size: files.size,
                  mimetype: files.mimetype
                };
              }
            });
          }
          
          // Update request body with processed version
          Object.assign(requestBody, processedRequestBody);
        }
        
        // Get response headers
        const responseHeaders = res.getHeaders ? res.getHeaders() : {};
        
        // Parse request URL
        const protocol = req.protocol || (req.connection && req.connection.encrypted ? 'https' : 'http');
        const host = req.get('host') || req.headers.host;
        const url = `${protocol}://${host}${req.originalUrl || req.url}`;
        
        // Build the payload according to Treblle specification
        const payload = {
          api_key: self.sdkToken,
          project_id: self.apiKey,
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
              ip: getClientIp(req),
              url: url,
              route_path: req._treblleRoutePath || '',
              user_agent: req.headers['user-agent'] || '',
              method: req.method,
              headers: maskSensitiveData(req.headers, self.options.additionalMaskedFields),
              body: maskSensitiveData(requestBody, self.options.additionalMaskedFields)
            },
            response: {
              headers: maskSensitiveData(responseHeaders, self.options.additionalMaskedFields),
              code: res.statusCode,
              size: calculateResponseSize(responseBody, res),
              load_time: duration,
              body: maskSensitiveData(responseBody, self.options.additionalMaskedFields)
            },
            errors: res._treblleErrors || []
          }
        };
        
        // Asynchronously send data to Treblle (fire and forget)
        setImmediate(() => {
          self._sendPayload(payload);
        });
        
        return originalEnd.apply(res, arguments);
      }.bind(this);
      
      // Continue to the next middleware
      next();
    };
  }

  /**
   * @method errorHandler
   * @description Express error handling middleware
   * @returns Express error middleware function
   */
  errorHandler() {
    return (err: Error, _req: any, res: any, next: any) => {
      // Skip if SDK is disabled for this environment
      if (!this.enabled) {
        return next(err);
      }
      
      if (err) {
        // Initialize error array if not exists
        res._treblleErrors = res._treblleErrors || [];
        
        // Extract error information with stack trace
        const error = this._processError(err);
        
        // Add to errors array
        res._treblleErrors.push(error);
      }
      
      // Continue to the next error handler
      next(err);
    };
  }

  /**
   * @method _processError
   * @private
   * @description Extract useful information from an error
   * @param err - The error object
   * @returns Formatted error info
   */
  private _processError(err: any): TreblleError {
    // Default values if extraction fails
    let errorInfo: TreblleError = {
      file: 'unknown',
      line: 0,
      message: err.message || 'Unknown error'
    };
    
    try {
      // Get the stack trace
      const stack = err.stack || '';
      
      // Parse the stack trace to extract filename and line number
      const stackLines = stack.split('\n');
      
      // Find first line with file information (after the error message)
      for (let i = 1; i < stackLines.length; i++) {
        const line = stackLines[i].trim();
        
        // Look for the common Node.js stack trace format
        const match = line.match(/at\s+(?:.*?\s+\()?(?:(.+):(\d+):(\d+))/);
        if (match) {
          const [_, filePath, lineNumber] = match;
          
          // Extract just the filename from the path
          const fileName = filePath.split(/[\/\\]/).pop() || 'unknown';
          
          errorInfo.file = fileName;
          errorInfo.line = parseInt(lineNumber, 10);
          break;
        }
      }
    } catch (e: unknown) {
      // If parsing fails, use the default values
      const errorMessage = e instanceof Error ? e.message : String(e);
      this._handleError(new Error(`Error parsing stack trace: ${errorMessage}`));
    }
    
    return errorInfo;
  }

  /**
   * @method _sendPayload
   * @private
   * @description Send payload to a random Treblle endpoint
   * @param payload - The payload to send
   */
  private _sendPayload(payload: any): void {
    try {
      // Select random endpoint
      const endpoint = TREBLLE_ENDPOINTS[Math.floor(Math.random() * TREBLLE_ENDPOINTS.length)];
      
      // Parse URL
      const url = new URL(endpoint);
      
      // Validate URL is HTTPS
      if (url.protocol !== 'https:') {
        this._handleError(new Error('Treblle SDK only supports HTTPS endpoints'));
        return;
      }
      
      // Prepare request options
      const options = {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.sdkToken
        }
      };
      
      // Create HTTPS request
      const req = https.request(options, (res) => {
        // Fire and forget - we don't care about the response
        res.on('data', () => {});
        res.on('end', () => {});
      });
      
      // Handle request errors silently
      req.on('error', (error: Error) => {
        this._handleError(error);
      });
      
      // Set reasonable timeout
      req.setTimeout(5000, () => {
        req.destroy();
        this._handleError(new Error('Treblle request timeout'));
      });
      
      // Helper function to ensure proper JSON formatting
      const safeStringify = (obj: any): string => {
        return JSON.stringify(obj, (_key, value) => {
          // If the value is already a string that looks like JSON, parse it 
          // to prevent double-escaping
          if (typeof value === 'string') {
            try {
              // Check if this string appears to be JSON
              if ((value.startsWith('{') && value.endsWith('}')) || 
                  (value.startsWith('[') && value.endsWith(']'))) {
                // Try to parse it
                const parsed = JSON.parse(value);
                // If successful, return the parsed object instead of the string
                return parsed;
              }
            } catch (e) {
              // Not valid JSON, leave as string
            }
          }
          return value;
        });
      };
      
      // Send data with better JSON handling
      req.write(safeStringify(payload));
      req.end();
    } catch (error: unknown) {
      if (error instanceof Error) {
        this._handleError(error);
      } else {
        this._handleError(new Error(`Unknown error: ${String(error)}`));
      }
    }
  }

  /**
   * @method _shouldExcludePath
   * @private
   * @description Determines if a path should be excluded from monitoring
   * @param path - Request path
   * @returns True if path should be excluded
   */
  private _shouldExcludePath(path: string): boolean {
    for (const pattern of this.excludePaths) {
      if (this._matchesPattern(path, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @method _isPathIncluded
   * @private
   * @description Determines if a path should be included in monitoring
   * @param path - Request path
   * @returns True if path should be included
   */
  private _isPathIncluded(path: string): boolean {
    // If includePaths is empty, include all paths
    if (this.includePaths.length === 0) {
      return true;
    }
    
    for (const pattern of this.includePaths) {
      if (this._matchesPattern(path, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @method _matchesPattern
   * @private
   * @description Check if a path matches a pattern
   * @param path - Request path
   * @param pattern - Pattern to match against
   * @returns True if path matches the pattern
   */
  private _matchesPattern(path: string, pattern: string | RegExp): boolean {
    // If pattern is a RegExp, test against it
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    
    // If pattern is a string, check for exact match or wildcard
    if (typeof pattern === 'string') {
      // Convert to comparable format (remove trailing slash if any)
      const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
      const normalizedPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
      
      // Check for exact match
      if (normalizedPath === normalizedPattern) {
        return true;
      }
      
      // Check for wildcard pattern (ending with *)
      if (normalizedPattern.endsWith('*')) {
        const prefix = normalizedPattern.slice(0, -1);
        return normalizedPath.startsWith(prefix);
      }
    }
    
    return false;
  }

  /**
   * @method _handleError
   * @private
   * @description Handles errors silently or logs them in debug mode
   * @param error - Error object
   */
  private _handleError(error: Error) {
    if (this.debug && error) {
      console.error('[Treblle SDK Error]:', error.message);
    }
  }
}

// Export integrations directly as named exports
export const express = expressIntegration;
export const nestjs = nestjsIntegration;

// Export the integrations object for backwards compatibility
export const integrations = {
  express: expressIntegration,
  nestjs: nestjsIntegration
};

// Export the Treblle class as both default and named export
export { Treblle };
export default Treblle;