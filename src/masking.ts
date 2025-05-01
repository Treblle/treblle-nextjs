/**
 * @file src/masking.ts
 * @description Data masking functionality for Treblle SDK
 */

import { DEFAULT_MASKED_FIELDS } from './types';

/**
 * @function maskSensitiveData
 * @description Masks sensitive data in objects
 * @param data - The data to mask
 * @param additionalFields - Additional fields to mask beyond the defaults
 * @returns Masked data
 */
export function maskSensitiveData(data: any, additionalFields: string[] = []): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Combine default and additional fields
  const fieldsToMask = [...DEFAULT_MASKED_FIELDS, ...additionalFields];
  
  // Handle Buffer or binary data
  if (Buffer.isBuffer(data)) {
    return { __type: 'binary', size: data.length };
  }
  
  // Function to determine if an object is too large or complex to process
  const isLargeObject = (obj: any): boolean => {
    try {
      const json = JSON.stringify(obj);
      // If object is larger than ~2MB, consider it too large
      return json.length > 2000000;
    } catch (e) {
      // If object can't be stringified, it's likely too complex
      return true;
    }
  };
  
  // Check payload size before processing
  if (isLargeObject(data)) {
    // Return a placeholder for large objects
    return { __type: 'large_object', message: 'Object too large to process' };
  }
  
  // Create a deep copy to avoid modifying original
  let maskedData: any;
  try {
    maskedData = JSON.parse(JSON.stringify(data));
  } catch (e) {
    // If we can't clone the object, return a simplified representation
    return { __type: 'unprocessable', message: 'Unable to process object' };
  }
  
  // Process object recursively
  const processObject = (obj: any, depth = 0) => {
    // Prevent too deep recursion
    if (depth > 10) return;
    
    for (const key in obj) {
      // Skip if property doesn't exist
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        continue;
      }
      
      // Check if key or value indicates a file
      const isFileKey = ['file', 'files', 'buffer', 'image', 'document', 'attachment', 'upload']
        .includes(key.toLowerCase());
        
      const isFileObj = obj[key] && typeof obj[key] === 'object' && 
                       (obj[key].buffer || obj[key].data || obj[key].path) && 
                       (obj[key].mimetype || obj[key].type || obj[key].filename || obj[key].originalname);
      
      // Handle file objects
      if (isFileKey && isFileObj) {
        const fileObj = obj[key];
        obj[key] = {
          __type: 'file',
          filename: fileObj.originalname || fileObj.filename || 'unknown',
          size: fileObj.size || (fileObj.buffer ? fileObj.buffer.length : 0) || 0,
          mimetype: fileObj.mimetype || fileObj.type || 'application/octet-stream'
        };
        continue;
      }
      
      // Check if current key should be masked
      const shouldMask = fieldsToMask.some(field => 
        key.toLowerCase() === field.toLowerCase()
      );
      
      if (shouldMask && obj[key]) {
        // Mask the value with asterisks, keeping same length
        if (typeof obj[key] === 'string') {
          obj[key] = '*'.repeat(obj[key].length);
        } else {
          obj[key] = '*****';
        }
      } else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        // Recursively process nested objects
        processObject(obj[key], depth + 1);
      } else if (Array.isArray(obj[key])) {
        // Process each array item
        for (let i = 0; i < obj[key].length; i++) {
          if (obj[key][i] && typeof obj[key][i] === 'object') {
            processObject(obj[key][i], depth + 1);
          }
        }
      }
    }
  };
  
  processObject(maskedData);
  return maskedData;
}