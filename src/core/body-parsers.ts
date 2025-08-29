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

// Express-specific functions removed - NextJS only SDK
