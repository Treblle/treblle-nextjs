/**
 * @file src/core/payload-size.ts
 * @description Memory-efficient payload size checking and handling
 */

export interface PayloadSizeInfo {
  size: number;
  isLarge: boolean;
  exceedsLimit: boolean;
  estimatedSize?: number;
}

export interface PayloadSizeOptions {
  maxSize?: number; // Maximum size in bytes (default: 5MB)
  warningSize?: number; // Warning threshold in bytes (default: 2MB)
  enableEstimation?: boolean; // Enable size estimation for large objects
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_WARNING_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Memory-efficient size estimation for objects without full serialization
 * @param obj - Object to estimate size for
 * @param maxDepth - Maximum depth to traverse (prevents infinite recursion)
 * @returns Estimated size in bytes
 */
export function estimateObjectSize(obj: any, maxDepth = 10): number {
  if (maxDepth <= 0) return 0;
  
  if (obj === null || obj === undefined) return 0;
  
  // Handle primitives
  if (typeof obj === 'string') return Buffer.byteLength(obj, 'utf8');
  if (typeof obj === 'number') return 8; // Assuming 64-bit numbers
  if (typeof obj === 'boolean') return 1;
  if (typeof obj === 'bigint') return 16;
  if (typeof obj === 'symbol') return 8;
  
  // Handle Buffer
  if (Buffer.isBuffer(obj)) return obj.length;
  
  // Handle Arrays
  if (Array.isArray(obj)) {
    let size = 24; // Array overhead
    for (let i = 0; i < obj.length; i++) {
      size += estimateObjectSize(obj[i], maxDepth - 1);
      // Early exit if we're already over threshold
      if (size > DEFAULT_MAX_SIZE) return size;
    }
    return size;
  }
  
  // Handle Objects
  if (typeof obj === 'object') {
    let size = 24; // Object overhead
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        size += Buffer.byteLength(key, 'utf8'); // Key size
        size += estimateObjectSize(obj[key], maxDepth - 1); // Value size
        // Early exit if we're already over threshold
        if (size > DEFAULT_MAX_SIZE) return size;
      }
    }
    return size;
  }
  
  // Fallback
  return 8;
}

/**
 * Check payload size with memory-efficient approach
 * @param data - Data to check
 * @param options - Size checking options
 * @returns Size information
 */
export function checkPayloadSize(data: any, options: PayloadSizeOptions = {}): PayloadSizeInfo {
  const maxSize = options.maxSize || DEFAULT_MAX_SIZE;
  const warningSize = options.warningSize || DEFAULT_WARNING_SIZE;
  const enableEstimation = options.enableEstimation !== false;
  
  // Quick check for null/undefined
  if (data === null || data === undefined) {
    return {
      size: 0,
      isLarge: false,
      exceedsLimit: false
    };
  }
  
  let actualSize: number;
  let estimatedSize: number | undefined;
  
  // Try estimation first if enabled
  if (enableEstimation) {
    estimatedSize = estimateObjectSize(data);
    
    // If estimation suggests it's over the limit, don't serialize
    if (estimatedSize > maxSize) {
      return {
        size: estimatedSize,
        isLarge: true,
        exceedsLimit: true,
        estimatedSize
      };
    }
  }
  
  // For smaller objects or when estimation is disabled, try actual serialization
  try {
    const jsonString = JSON.stringify(data);
    actualSize = Buffer.byteLength(jsonString, 'utf8');
    
    return {
      size: actualSize,
      isLarge: actualSize > warningSize,
      exceedsLimit: actualSize > maxSize,
      estimatedSize
    };
  } catch (error) {
    // If serialization fails, fall back to estimation or default
    const fallbackSize = estimatedSize || 0;
    return {
      size: fallbackSize,
      isLarge: fallbackSize > warningSize,
      exceedsLimit: fallbackSize > maxSize,
      estimatedSize
    };
  }
}

/**
 * Create a size-aware payload replacement for large objects
 * @param data - Original data
 * @param sizeInfo - Size information from checkPayloadSize
 * @returns Replacement object with size metadata
 */
export function createPayloadReplacement(data: any, sizeInfo: PayloadSizeInfo): any {
  const replacement: any = {
    __type: 'large_payload',
    message: 'Payload exceeds size limit',
    size: sizeInfo.size,
    maxSize: DEFAULT_MAX_SIZE
  };
  
  if (sizeInfo.estimatedSize !== undefined) {
    replacement.estimatedSize = sizeInfo.estimatedSize;
  }
  
  // Add type information if available
  if (data !== null && data !== undefined) {
    replacement.originalType = typeof data;
    
    if (Array.isArray(data)) {
      replacement.originalType = 'array';
      replacement.length = data.length;
    } else if (Buffer.isBuffer(data)) {
      replacement.originalType = 'buffer';
      replacement.length = data.length;
    } else if (typeof data === 'object') {
      replacement.keys = Object.keys(data).slice(0, 5); // Show first 5 keys
      if (Object.keys(data).length > 5) {
        replacement.keys.push('...');
      }
    }
  }
  
  return replacement;
}

/**
 * Process payload with size checking and replacement
 * @param data - Data to process
 * @param options - Processing options
 * @returns Processed data or replacement object
 */
export function processPayloadWithSizeCheck(data: any, options: PayloadSizeOptions = {}): any {
  const sizeInfo = checkPayloadSize(data, options);
  
  if (sizeInfo.exceedsLimit) {
    return createPayloadReplacement(data, sizeInfo);
  }
  
  return data;
}
