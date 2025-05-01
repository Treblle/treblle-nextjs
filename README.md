# Treblle SDK for NodeJS

Official Treblle SDK for NodeJS applications. Monitor API requests in real-time with zero performance impact.

## Features

- 🔄 Real-time API monitoring
- 🔒 Automatic sensitive data masking
- 🚀 Zero performance impact with fire-and-forget approach
- 🛡️ Built with security and privacy in mind
- 🪶 Lightweight with minimal dependencies
- 🔌 Easy integration with Express
- 🧩 TypeScript support
- 📦 Smart handling of file uploads and downloads
- 🧠 Intelligent processing of non-JSON responses
- 🛑 Automatic detection and handling of large payloads
- 🐛 Detailed error tracking with file and line information
- 🔍 Automatic endpoint path detection
- 🌎 Environment-based configuration

## Installation

```bash
npm install treblle-sdk --save
```

## Quick Start

```javascript
const express = require('express');
const Treblle = require('treblle-sdk');

// Initialize Treblle
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  additionalMaskedFields: ['custom_field_to_mask'],
  debug: false, // set to true to see errors in console
  environments: {
    // Disable in test environment
    disabled: ['test']
  }
});

const app = express();

// Parse JSON bodies
app.use(express.json());

// Enable Treblle middleware on all routes
app.use(treblle.middleware());

// Or enable it only on specific routes
app.use('/api/v1', treblle.middleware(), apiRoutes);

// Add Treblle error handler (before your own error handler)
app.use(treblle.errorHandler());

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
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

The SDK can detect your application's environment and adjust its behavior accordingly, allowing you to enable or disable monitoring based on where your app is running.

### Default Behavior

By default, the SDK is **enabled in all environments**. This ensures monitoring is always active unless explicitly disabled.

### Environment Configuration Example

Here's a complete example of using environment-based configuration:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  
  // Environment configuration options
  environments: {
    // Never monitor in test environments
    disabled: ['test', 'ci'],
    
    // When running in custom environments, only monitor these specific ones
    enabled: ['production', 'staging', 'development', 'custom-env-with-monitoring'],
    
    // For any environment not listed above, enable monitoring (this is the default)
    default: true
  }
});
```

### Configuration Options

You can customize environment behavior using several options:

#### Disabling in Specific Environments

To disable the SDK in specific environments (e.g., development, testing):

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  environments: {
    disabled: ['development', 'test'] // Disable in these environments
  }
});
```

#### Enabling Only in Specific Environments

To enable the SDK only in specific environments:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  environments: {
    enabled: ['production', 'staging'], // Enable only in these environments
    default: false                      // Disable in all other environments
  }
});
```

#### Completely Disabling the SDK

To disable the SDK globally regardless of environment:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  enabled: false // Disable SDK in all environments
});
```

### Environment Configuration Reference

The `environments` option can be configured with these properties:

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | string[] | Array of environment names where the SDK should be enabled. If specified, the SDK will ONLY be enabled in these environments unless `default` is true. |
| `disabled` | string[] | Array of environment names where the SDK should be disabled. Takes precedence over `enabled`. |
| `default` | boolean | Default behavior for environments not explicitly listed (default: `true` = enabled) |

### Environment Names

Common environment names that can be used in configuration:
- `production` (or `prod`)
- `staging` (or `stage`)
- `qa`
- `testing` (or `test`)
- `development` (or `dev`)
- `local`

### Debug Information

In debug mode, the SDK will log which environment was detected and whether monitoring is enabled:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  debug: true,
  environments: {
    disabled: ['development']
  }
});

// Console output in development:
// [Treblle SDK] Initialized in development environment. SDK disabled.
```

## Route Path Detection

The SDK automatically captures API endpoint route patterns to help with API monitoring and documentation:

### How It Works

When an API request is processed, Treblle identifies the Express route pattern instead of the specific URL with parameters:

```javascript
// Original URL with parameter
// GET /api/users/123/profile

// Express route definition
// app.get('/api/users/:id/profile', ...);

// Detected route path in Treblle
"route_path": "/users/:id/profile"
```

This helps you:
- Group similar API requests together
- Generate accurate API documentation
- Track endpoint usage and performance
- Identify problematic endpoints

### Using Express Route Information

The SDK extracts route patterns directly from Express route definitions, preserving parameter placeholders like `:id` or `:userId` exactly as defined in your routes.

This gives you accurate endpoint grouping with zero configuration required.

## Error Handling

The SDK can automatically capture and report detailed information about errors that occur in your API:

### Using the Error Handler Middleware

```javascript
const express = require('express');
const Treblle = require('treblle-sdk');

const app = express();
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY'
});

// Apply the regular Treblle middleware
app.use(treblle.middleware());

// Your routes and other middleware here
app.get('/api/users', (req, res) => {
  // API logic
});

// Add the Treblle error handler BEFORE your app's error handler
// This ensures Treblle can capture error details
app.use(treblle.errorHandler());

// Your application's error handler comes after
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Server error' });
});
```

### Error Information Captured

For each error, Treblle captures:

- **File**: Name of the JavaScript file where the error occurred
- **Line**: Line number in the file where the error occurred
- **Message**: The error message

This information is sent in the `errors` array of the Treblle payload, helping you quickly identify and fix issues in your API.

### Example Error Output

```json
{
  "errors": [
    {
      "file": "users.controller.js",
      "line": 42,
      "message": "Cannot read property 'id' of undefined"
    }
  ]
}
```

### Handling Errors

The SDK intelligently extracts stack trace information while respecting your privacy and security. Only the minimal necessary information is sent - no sensitive data or full stack traces are transmitted.

## Handling Large Payloads

The SDK automatically detects and handles exceptionally large objects (over 2MB) to prevent memory issues:

```javascript
// What Treblle receives for very large objects
{
  "__type": "large_object",
  "message": "Object too large to process"
}
```

## Handling Files and Non-JSON Responses

The SDK intelligently handles various edge cases:

### File Uploads

When files are uploaded to your API, the SDK detects them and replaces the binary content with metadata:

```javascript
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

### File Downloads

When your API returns files or binary data, the SDK detects this and sends metadata instead:

```javascript
// What Treblle receives instead of binary data
{
  "__type": "file",
  "size": 1024000,
  "contentType": "application/pdf"
}
```

### Non-JSON Responses

If your API returns HTML or other non-JSON content, the SDK handles this gracefully:

1. For HTML responses: Sends an empty object to Treblle
2. For binary responses: Sends metadata about the binary content
3. For malformed JSON: Logs the request but replaces the response with an empty object

## Advanced Usage

### Custom Field Masking

You can add your own fields to be masked:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  additionalMaskedFields: [
    'my_secret_field',
    'user.personal.phone',
    'sensitive_data'
  ]
});
```

### Path Filtering

You can control which API endpoints are monitored using path filtering:

#### Excluding Paths

Exclude health checks, metrics, and auth endpoints from monitoring:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  excludePaths: [
    '/health',
    '/metrics',
    '/api/auth',
    /^\/admin\/.*/ // Exclude all paths starting with /admin/
  ]
});
```

#### Including Specific Paths

Only monitor specific API versions or endpoints:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  includePaths: [
    '/api/v2/*',     // Include all v2 API routes
    '/api/public/*', // Include all public API routes
    /^\/api\/users\/.*/  // Include all user-related routes
  ]
});
```

#### Pattern Matching

Path patterns can be specified in several ways:
- Exact match: `/api/users`
- Wildcard match: `/api/v1/*` (matches any path starting with `/api/v1/`)
- Regular expressions: `/^\/api\/v[0-9]+\/.*/` (matches any versioned API path)

### Using Environment Variables

For better security, use environment variables:

```javascript
// .env file
TREBLLE_SDK_TOKEN=your_sdk_token
TREBLLE_API_KEY=your_api_key

// app.js
require('dotenv').config();

const treblle = new Treblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY
});
```

## How It Works

The Treblle SDK:

1. Captures the request data when it comes in
2. Intercepts the response data before it's sent back
3. Masks sensitive information according to your configuration
4. Sends the data to Treblle servers using a fire-and-forget approach
5. Does all of this with zero impact on your API's performance

## Handling Errors

The SDK is designed to handle all errors silently without affecting your API. If you want to see potential errors, enable debug mode:

```javascript
const treblle = new Treblle({
  sdkToken: 'YOUR_SDK_TOKEN',
  apiKey: 'YOUR_API_KEY',
  debug: true // Errors will be logged to console
});
```

## Framework Support

Currently, this SDK officially supports Express. Support for other frameworks like AdonisJS, NestJS, and Koa is coming soon.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you have any questions or issues, please [open an issue](https://github.com/treblle/treblle-sdk-nodejs/issues) or contact the Treblle team.