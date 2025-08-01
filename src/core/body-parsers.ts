/**
 * @file src/core/body-parsers.ts
 * @description Shared request/response body parsing utilities
 */

/**
 * Helper to safely parse Next.js Request body
 * @param req - Cloned Next.js Request object
 * @returns Parsed request body
 */
export async function parseNextjsRequestBody(req: Request): Promise<any> {
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
 * Helper to safely parse Next.js Response body
 * @param res - Cloned Next.js Response object
 * @returns Parsed response body
 */
export async function parseNextjsResponseBody(res: Response): Promise<any> {
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
 * Helper to process Express-style request body for file uploads
 * @param req - Express request object
 * @param requestBody - Initial request body
 * @returns Processed request body with file metadata
 */
export function processExpressRequestBody(req: any, requestBody: any): any {
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

    return processedRequestBody;
  }

  return requestBody;
}

/**
 * Helper to process Express response body
 * @param chunk - Response chunk
 * @param responseBody - Existing response body
 * @param res - Express response object
 * @returns Processed response body
 */
export function processExpressResponseBody(chunk: any, responseBody: any, res: any): any {
  // Process response body
  if (chunk && typeof chunk !== 'function' && Object.keys(responseBody).length === 0) {
    try {
      // Try to parse as JSON
      if (typeof chunk === 'string') {
        try {
          // Parse string to get actual object
          return JSON.parse(chunk);
        } catch (e) {
          // If it's not valid JSON, keep as string
          return { __type: 'text', content: chunk };
        }
      } else if (Buffer.isBuffer(chunk)) {
        // Try to parse buffer as JSON
        try {
          const stringChunk = chunk.toString('utf8');
          return JSON.parse(stringChunk);
        } catch (e) {
          // Not JSON, mark as binary
          return { __type: 'binary', size: chunk.length };
        }
      } else if (typeof chunk === 'object') {
        // If it's already an object, use it directly - don't stringify
        return chunk;
      }
    } catch (e) {
      // Not valid JSON, use empty object
      return { __type: 'non-json' };
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
    return {
      __type: 'file',
      size: contentLength,
      contentType: contentType
    };
  } else if (!isJSON && typeof responseBody === 'object' && responseBody &&
            '__type' in responseBody && responseBody.__type === 'non-json') {
    // For non-JSON responses, store empty object
    return {};
  }

  return responseBody;
}
