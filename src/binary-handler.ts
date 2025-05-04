/**
 * @file src/binary-handler.ts
 * @description Specialized handling for binary and file data
 */

/**
 * Type definitions for file metadata
 */
export interface FileMetadata {
  __type: 'file';
  filename?: string;
  size: number;
  mimetype?: string;
  contentType?: string;
}

/**
 * Types of binary content
 */
export enum BinaryType {
  File = 'file',
  Binary = 'binary',
  Text = 'text',
  LargeObject = 'large_object',
  Unprocessable = 'unprocessable',
  NonJson = 'non-json'
}

/**
 * List of MIME types that should be treated as files
 */
export const FILE_MIME_TYPES = [
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/x-compressed',
  'application/x-zip-compressed',
  'multipart/form-data'
];

/**
 * List of MIME type prefixes that should be treated as files
 */
export const FILE_MIME_PREFIXES = [
  'image/',
  'audio/',
  'video/', 
  'font/',
  'application/vnd.'
];

/**
 * List of keys that typically indicate file objects in request bodies
 */
export const FILE_INDICATOR_KEYS = [
  'file',
  'files',
  'buffer',
  'image',
  'document',
  'attachment',
  'upload',
  'picture',
  'photo',
  'avatar',
  'blob',
  'binary'
];

/**
 * Determines if the content type indicates a file
 * @param contentType - The content type string to check
 * @returns True if the content type indicates a file
 */
export function isFileContentType(contentType: string | undefined | null): boolean {
  if (!contentType) return false;
  
  const contentTypeStr = contentType.toString().toLowerCase();
  
  // Check for exact matches
  if (FILE_MIME_TYPES.some(type => contentTypeStr.includes(type))) {
    return true;
  }
  
  // Check for prefix matches
  return FILE_MIME_PREFIXES.some(prefix => contentTypeStr.startsWith(prefix));
}

/**
 * Determines if a content disposition header indicates a file
 * @param disposition - The content disposition header
 * @returns True if the disposition indicates a file
 */
export function isFileDisposition(disposition: string | undefined | null): boolean {
  if (!disposition) return false;
  
  const dispositionStr = disposition.toString().toLowerCase();
  return dispositionStr.includes('attachment') || dispositionStr.includes('filename');
}

/**
 * Creates a safe representation of a file
 * @param fileObj - The file object
 * @returns Safe file metadata representation
 */
export function createFileMetadata(fileObj: any): FileMetadata {
  return {
    __type: BinaryType.File,
    filename: fileObj.originalname || fileObj.filename || 'unknown',
    size: fileObj.size || (fileObj.buffer ? fileObj.buffer.length : 0) || 0,
    mimetype: fileObj.mimetype || fileObj.type || 'application/octet-stream'
  };
}

/**
 * Identifies file objects in request bodies based on known patterns
 * @param obj - Object to check
 * @param key - Property key
 * @returns True if the object appears to be a file
 */
export function isFileObject(obj: any, key: string): boolean {
  // Check if key is a common file indicator
  const isFileKey = FILE_INDICATOR_KEYS.includes(key.toLowerCase());
  
  // Check if object has typical file properties
  const isFileObj = obj && 
                   typeof obj === 'object' && 
                   (obj.buffer || obj.data || obj.path) && 
                   (obj.mimetype || obj.type || obj.filename || obj.originalname);
  
  return isFileKey && isFileObj;
}

/**
 * Handle multer-style file uploads (both single and multiple)
 * @param req - The request object
 * @param requestBody - The current request body
 * @returns Updated request body with safe file representations
 */
export function processRequestFiles(req: any, requestBody: any): any {
  if (!req || !requestBody) return requestBody;
  
  const processedRequestBody = { ...requestBody };
  
  // Handle multer single file upload
  if (req.file && req.file.buffer) {
    processedRequestBody[req.file.fieldname] = createFileMetadata(req.file);
  }
  
  // Handle multer multiple file upload
  if (req.files) {
    Object.keys(req.files).forEach(fieldname => {
      const files = req.files[fieldname];
      if (Array.isArray(files)) {
        // Multiple files in this field
        processedRequestBody[fieldname] = files.map(file => createFileMetadata(file));
      } else {
        // Single file in this field
        processedRequestBody[fieldname] = createFileMetadata(files);
      }
    });
  }
  
  return processedRequestBody;
}

/**
 * Process a response body chunk to determine its type and create a safe representation
 * @param chunk - The response chunk
 * @param contentType - The content type header
 * @param contentDisposition - The content disposition header
 * @param contentLength - The content length header
 * @returns Processed response body
 */
export function processResponseBody(
  chunk: any,
  contentType?: string | null,
  contentDisposition?: string | null,
  contentLength?: number | string
): any {
  // Handle null/undefined case
  if (!chunk) return {};
  
  // If it's a function, return empty object (can't serialize functions)
  if (typeof chunk === 'function') return {};
  
  try {
    // Check if it's a file based on headers
    const isFile = isFileDisposition(contentDisposition) || isFileContentType(contentType);
    const isJSON = contentType?.toString().includes('application/json');
    
    // If it's clearly a file based on headers, return file metadata
    if (isFile) {
      return {
        __type: BinaryType.File,
        size: contentLength || 0,
        contentType: contentType
      };
    }
    
    // Process different types of chunks
    if (typeof chunk === 'string') {
      // Try to parse as JSON
      try {
        return JSON.parse(chunk);
      } catch (e) {
        // If it's not valid JSON, keep as text representation
        return { __type: BinaryType.Text, size: chunk.length };
      }
    } else if (Buffer.isBuffer(chunk)) {
      // Try to parse buffer as JSON
      try {
        const stringChunk = chunk.toString('utf8');
        return JSON.parse(stringChunk);
      } catch (e) {
        // Not JSON, mark as binary
        return { __type: BinaryType.Binary, size: chunk.length };
      }
    } else if (typeof chunk === 'object') {
      // If it's already an object with a __type marker
      if (chunk.__type === BinaryType.Binary || chunk.__type === BinaryType.File) {
        return {
          __type: chunk.__type,
          size: chunk.size || 0,
          contentType: contentType
        };
      }
      
      // Otherwise just return the object
      return chunk;
    }
    
    // Fallback for other types
    return { __type: BinaryType.NonJson };
  } catch (e) {
    // If all parsing fails
    return { __type: BinaryType.Unprocessable, message: 'Unable to process response body' };
  }
}

export default {
  isFileContentType,
  isFileDisposition,
  createFileMetadata,
  isFileObject,
  processRequestFiles,
  processResponseBody,
  BinaryType,
  FILE_MIME_TYPES,
  FILE_MIME_PREFIXES,
  FILE_INDICATOR_KEYS
};