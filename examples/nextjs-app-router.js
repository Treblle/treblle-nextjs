/**
 * Next.js App Router API Route Example
 * This demonstrates how to use Treblle SDK with Next.js App Router
 */

// Import the Next.js integration
import { withTreblle } from 'treblle-js/integrations/nextjs';

// Configure Treblle
const treblleWrapper = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY,
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

