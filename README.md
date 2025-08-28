# Treblle SDK for Next.js

Official Treblle SDK for Next.js applications. Monitor API requests in real-time with zero performance impact.

## Features

- 🔄 Real-time API monitoring for Next.js App Router and Pages Router
- 🔒 Automatic sensitive data masking
- 🚀 Zero performance impact with fire-and-forget approach
- 🛡️ Built with security and privacy in mind
- 🪶 Lightweight with minimal dependencies
- 🔌 Easy integration with Next.js API routes and middleware
- 🧩 Full TypeScript support with Next.js types
- 📦 Smart handling of file uploads and downloads
- 🧠 Intelligent processing of streaming responses
- 🛑 Automatic detection and handling of large payloads
- 🐛 Detailed error tracking with file and line information
- 🔍 Automatic dynamic route detection (`[id]`, `[...slug]`)
- 🌐 Edge Runtime support
- ⚡ Serverless environment optimizations
- 🌎 Environment-based configuration

## Installation

```bash
npm install treblle-js --save
```

## Quick Start

### Basic App Router Integration

```typescript
// app/api/users/route.ts
import { withTreblle } from 'treblle-js/integrations/nextjs';

const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  debug: process.env.NODE_ENV !== 'production',
});

export const GET = treblle(async (request: Request, { params }) => {
  // Your API logic here
  const users = await getUsers();
  return Response.json({ users });
});

export const POST = treblle(async (request: Request) => {
  const body = await request.json();
  const user = await createUser(body);
  return Response.json({ user }, { status: 201 });
});
```


### Middleware Integration

Create a `middleware.ts` file in your project root:

```typescript
// middleware.ts
import { createMiddlewareWrapper } from 'treblle-js/integrations/nextjs-middleware';

const withTreblle = createMiddlewareWrapper({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
});

export const middleware = withTreblle(async (request) => {
  // Your middleware logic here
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

## Environment Setup

Create a `.env.local` file in your project root:

```bash
TREBLLE_SDK_TOKEN=your_sdk_token_here
TREBLLE_API_KEY=your_api_key_here
NODE_ENV=development
```

## Configuration Options

The Treblle SDK accepts the following configuration options:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `sdkToken` | string | Yes | Your Treblle SDK token obtained during registration |
| `apiKey` | string | Yes | Your Treblle API key |
| `additionalMaskedFields` | string[] | No | Additional field names to mask beyond the default ones |
| `debug` | boolean | No | Enable debug mode to log errors to console (default: `false`) |
| `excludePaths` | (string \| RegExp)[] | No | Paths to exclude from monitoring (e.g., `['/health', '/metrics']`) |
| `includePaths` | (string \| RegExp)[] | No | Paths to include in monitoring (e.g., `['/api/v1/*']`) |
| `enabled` | boolean | No | Explicitly enable or disable the SDK regardless of environment |
| `environments` | object \| boolean | No | Environment-specific configuration |
| `enableEdgeRuntime` | boolean | No | Enable Edge Runtime support (enhanced integration only) |
| `handleStreaming` | boolean | No | Handle streaming responses (enhanced integration only) |
| `maxBodySize` | number | No | Maximum body size to process in bytes (default: 2MB) |

## Next.js Specific Features

### Dynamic Route Detection

The SDK automatically detects and normalizes Next.js dynamic routes:

```typescript
// File: app/api/users/[id]/route.ts
// URL: /api/users/123
// Detected route: /api/users/[id]

// File: app/api/blog/[...slug]/route.ts  
// URL: /api/blog/2023/my-post
// Detected route: /api/blog/[...slug]

// File: app/api/(auth)/login/route.ts
// URL: /api/login  
// Detected route: /api/(auth)/login
```

### Route Groups Support

Route groups are automatically handled:

```typescript
// File: app/api/(auth)/login/route.ts
// File: app/api/(public)/health/route.ts
// Groups are preserved in route detection
```

### Edge Runtime Compatibility

The SDK works with both Node.js and Edge runtimes:

```typescript
// app/api/edge-example/route.ts
export const runtime = 'edge';

import { withTreblle } from 'treblle-js/integrations/nextjs-enhanced';

const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  enableEdgeRuntime: true, // Optimizes for Edge runtime
});

export const GET = treblle.handler(async (request) => {
  return Response.json({ message: 'Edge function monitored!' });
});
```

### Streaming Response Support

Handle Server-Sent Events and streaming responses:

```typescript
export const GET = treblle.handler(async (request) => {
  const stream = new ReadableStream({
    start(controller) {
      // Stream data
      controller.enqueue('data chunk');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
    },
  });
});
```

## Default Masked Fields

The following fields are automatically masked for security:

- password
- pwd
- secret
- password_confirmation
- passwordConfirmation
- cc
- card_number
- cardNumber
- ccv
- ssn
- credit_score
- creditScore
- api_key

Each character in these fields will be replaced with `*` to keep the same length but hide the actual values.

## Environment-Based Configuration

The SDK can detect your application's environment and adjust its behavior accordingly:

### Default Behavior

By default, the SDK is **enabled in all environments**. This ensures monitoring is always active unless explicitly disabled.

### Environment Configuration Examples

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  environments: {
    // Never monitor in test environments
    disabled: ['test', 'ci'],
    
    // Only monitor in these environments
    enabled: ['production', 'staging', 'development'],
    
    // Default for unlisted environments
    default: true
  }
});
```

### Disabling in Specific Environments

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  environments: {
    disabled: ['development', 'test']
  }
});
```

### Enabling Only in Production

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  environments: {
    enabled: ['production'],
    default: false
  }
});
```

## Error Handling

The SDK automatically captures and reports detailed information about errors:

### Automatic Error Capture

```typescript
export const POST = treblle.handler(async (request: Request) => {
  try {
    const body = await request.json();
    // API logic that might throw
    throw new Error('Something went wrong');
  } catch (error) {
    // Error is automatically captured by Treblle
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
```

### Error Information Captured

For each error, Treblle captures:

- **File**: Name of the file where the error occurred
- **Line**: Line number in the file where the error occurred  
- **Message**: The error message
- **Stack**: Sanitized stack trace (if available)

## Advanced Usage

### Custom Field Masking

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  additionalMaskedFields: [
    'my_secret_field',
    'user.personal.phone',
    'sensitive_data'
  ]
});
```

### Path Filtering

#### Excluding Paths

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  excludePaths: [
    '/api/health',
    '/api/metrics',
    /^\/api\/internal\/.*/ // Exclude all internal APIs
  ]
});
```

#### Including Specific Paths

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  includePaths: [
    '/api/public/*',
    '/api/v1/*',
    /^\/api\/users\/.*/
  ]
});
```

## Handling Large Payloads

The SDK automatically detects and handles exceptionally large objects (over 2MB by default) to prevent memory issues:

```typescript
// What Treblle receives for very large objects
{
  "__type": "large_object",
  "message": "Object too large to process"
}
```

## File Upload Detection

When files are uploaded to your API, the SDK detects them and replaces the binary content with metadata:

```typescript
// Original request with file upload
{
  "profile_image": <binary-data>
}

// What Treblle receives
{
  "profile_image": {
    "__type": "file",
    "filename": "profile.jpg",
    "size": 25000,
    "mimetype": "image/jpeg"
  }
}
```

## Performance Optimizations

### Serverless Environments

The SDK is optimized for serverless environments like Vercel:

- Minimal cold start impact
- Lazy initialization
- Efficient memory usage
- Request deduplication

### Development vs Production

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  debug: process.env.NODE_ENV !== 'production',
  // More detailed logging in development
  maxBodySize: process.env.NODE_ENV === 'production' ? 1024 * 1024 : 5 * 1024 * 1024,
});
```

## Integration Examples

### Pages Router Integration

For older Next.js applications using Pages Router:

```typescript
// pages/api/users.ts
import { withTreblle } from 'treblle-js/integrations/nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json({ users: [] });
  }
  
  if (req.method === 'POST') {
    const user = await createUser(req.body);
    return res.status(201).json({ user });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

export default treblle.pagesHandler(handler);
```

### TypeScript Support

Full TypeScript support with proper Next.js types:

```typescript
import { withTreblle, TreblleNextHandler } from 'treblle-js/integrations/nextjs-enhanced';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserParams {
  id: string;
}

const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
});

// Type-safe handler with parameter inference
export const GET: TreblleNextHandler<UserParams> = treblle.handler(
  async (request: Request, { params }) => {
    // params.id is correctly typed as string
    const user: User = await getUserById(params.id);
    return Response.json({ user });
  }
);
```

## How It Works

The Treblle SDK for Next.js:

1. Wraps your API route handlers with monitoring logic
2. Captures request data when it comes in
3. Intercepts response data before it's sent back
4. Masks sensitive information according to your configuration
5. Sends the data to Treblle servers using a fire-and-forget approach
6. Does all of this with zero impact on your API's performance
7. Handles Next.js-specific patterns like dynamic routes and route groups

## Debugging

Enable debug mode to see potential errors and monitoring activity:

```typescript
const treblle = withTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  debug: true // Errors and activity will be logged to console
});
```

## Best Practices

1. **Environment Variables**: Always use environment variables for sensitive credentials
2. **Path Filtering**: Use `excludePaths` to avoid monitoring health checks and internal endpoints
3. **Field Masking**: Add any additional sensitive fields to `additionalMaskedFields`
4. **Error Handling**: Let the SDK handle error capture automatically, but implement proper error boundaries
5. **Performance**: Use the enhanced integration for production applications with many features
6. **Middleware**: Use middleware integration for cross-cutting concerns like authentication and rate limiting

## Next.js Deployment

### Vercel

The SDK works seamlessly with Vercel deployments:

```bash
# .env.local (for development)
TREBLLE_SDK_TOKEN=your_token
TREBLLE_API_KEY=your_key

# Add to Vercel environment variables in dashboard
```

### Other Platforms

Compatible with all major Next.js hosting platforms:

- Vercel
- Netlify
- AWS Amplify
- Railway
- Heroku
- Self-hosted

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you have any questions or issues, please [open an issue](https://github.com/timpratim/treblle-js/issues) or contact the Treblle team.
