/**
 * @file src/types.ts
 * @description Type definitions for Treblle SDK
 */

/**
 * Configuration options for Treblle SDK
 */
export interface TreblleOptions {
    /**
     * Your Treblle SDK token obtained during registration
     */
    sdkToken: string;
    
    /**
     * Your Treblle API key
     */
    apiKey: string;
    
    /**
     * Additional fields to mask beyond the default ones
     */
    additionalMaskedFields?: string[];
    
    /**
     * Enable debug mode to log errors to console
     */
    debug?: boolean;

    /**
     * Verbose debug mode: logs endpoint selection, sanitized payload preview,
     * and Treblle response status/body (truncated). Intended for local testing.
     */
    debugVerbose?: boolean;
    
    /**
     * Paths to exclude from monitoring
     * Can be string patterns or RegExp objects
     * Examples: ['/health', '/metrics', /^\/admin\/.*\]
     */
    excludePaths?: (string | RegExp)[];
    
    /**
     * Paths to include in monitoring
     * If specified, only these paths will be monitored
     * Can be string patterns or RegExp objects
     * Examples: ['/api/v1/*', '/api/v2/*', /^\/public\/.*\/\]
     */
    includePaths?: (string | RegExp)[];
    
    /**
     * Explicitly enable or disable the SDK regardless of environment
     */
    enabled?: boolean;
    
    /**
     * Environment configuration
     */
    environments?: boolean | TreblleEnvironments;
    
    /**
     * Maximum payload size in bytes (default: 5MB)
     */
    maxPayloadSize?: number;
    
    /**
     * Warning threshold for large payloads in bytes (default: 2MB)
     */
    payloadWarningSize?: number;
    
    /**
     * Enable memory-efficient size estimation (default: true)
     */
    enableSizeEstimation?: boolean;
  }
  
  /**
   * Environment configuration for Treblle SDK
   */
  export interface TreblleEnvironments {
    /**
     * Environments in which the SDK should be enabled
     * Examples: ['production', 'staging']
     */
    enabled?: string[];
    
    /**
     * Environments in which the SDK should be disabled
     * Examples: ['development', 'test']
     */
    disabled?: string[];
    
    /**
     * Default behavior for environments not explicitly listed
     * If true, SDK will be enabled for unlisted environments
     * If false, SDK will be disabled for unlisted environments
     */
    default?: boolean;
  }
  
  /**
   * Error information structure
   */
  export interface TreblleError {
    /**
     * The name of the file where the error occurred
     */
    file: string;
    
    /**
     * The line number where the error occurred
     */
    line: number;
    
    /**
     * The error message
     */
    message: string;
  }
  
  /**
   * Request data structure
   */
  export interface TreblleRequest {
    /**
     * Timestamp of the request
     */
    timestamp: string;
    
    /**
     * IP address of the client
     */
    ip: string;
    
    /**
     * Full URL of the request
     */
    url: string;
    
    /**
     * Route path pattern (e.g., 'api/users/{id}/profile')
     */
    route_path: string;
    
    /**
     * User agent string
     */
    user_agent: string;
    
    /**
     * HTTP method
     */
    method: string;
    
    /**
     * Request headers
     */
    headers: Record<string, any>;
    
    /**
     * Query parameters (flattened as strings)
     */
    query: Record<string, string>;
    
    /**
     * Request body
     */
    body: any;
  }
  
  /**
   * Default masked fields
   */
  export const DEFAULT_MASKED_FIELDS = [
    'password',
    'pwd',
    'secret',
    'password_confirmation',
    'passwordConfirmation',
    'cc',
    'card_number',
    'cardNumber',
    'ccv',
    'ssn',
    'credit_score',
    'creditScore',
    'api_key',
    // Common auth and session tokens
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'access_token',
    'refresh_token',
    'id_token',
    'session',
    'jwt',
    'token'
  ];
