/**
 * Next.js App Router API Route Example
 * This demonstrates how to use Treblle SDK with Next.js App Router
 */

// Import the Next.js integration
import { withTreblle } from 'treblle-js/integrations/nextjs';

// Configure Treblle
const treblleWrapper = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN || 'your-sdk-token',
  apiKey: process.env.TREBLLE_API_KEY || 'your-api-key',
  debug: true,
  enabled: true,
  environments: ['development', 'production'],
});

// GET endpoint handler
async function getHandler(request, { params }) {
  const { searchParams } = new URL(request.url);
  const id = params?.id || searchParams.get('id');
  
  return Response.json({
    message: 'Hello from Next.js App Router!',
    id: id,
    timestamp: new Date().toISOString(),
    method: request.method
  });
}

// POST endpoint handler
async function postHandler(request, { params }) {
  const body = await request.json();
  
  return Response.json({
    message: 'Data received successfully',
    received: body,
    id: params?.id,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}

// Error handling example
async function errorHandler(request, { params }) {
  // This will trigger error tracking
  throw new Error('Test error for Treblle monitoring');
}

// Export wrapped handlers
export const GET = treblleWrapper(getHandler);
export const POST = treblleWrapper(postHandler);

// If you want to test error handling, uncomment:
// export const DELETE = treblleWrapper(errorHandler);

/**
 * File structure for Next.js App Router:
 * 
 * app/
 * ├── api/
 * │   ├── users/
 * │   │   └── route.js (this file)
 * │   └── users/
 * │       └── [id]/
 * │           └── route.js (for dynamic routes)
 * 
 * Usage examples:
 * GET /api/users
 * GET /api/users?id=123
 * POST /api/users
 * GET /api/users/123 (if using [id] dynamic route)
 */
