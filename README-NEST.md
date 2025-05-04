# Treblle SDK for NestJS Integration

This guide explains how to integrate Treblle with your NestJS applications to monitor API requests in real-time with precise microsecond timing.

## Installation

```bash
npm install treblle-js --save
```

## Quick Start

The Treblle SDK provides several integration approaches for NestJS applications.

### Option 1: Using the Function Middleware (Recommended)

This approach uses a simple function middleware, which avoids dependency injection issues and is the most reliable method.

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { Controller, Get, Post, Body, UseFilters, UseInterceptors } from '@nestjs/common';
import * as express from 'express';
import { nestjs as treblleNestJS } from 'treblle-js/integrations';

// Define Treblle options once
const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN || 'YOUR_SDK_TOKEN',
  apiKey: process.env.TREBLLE_API_KEY || 'YOUR_API_KEY',
  additionalMaskedFields: ['password'],
  debug: process.env.NODE_ENV !== 'production',
  environments: {
    disabled: ['test']
  }
};

// Extract filter and interceptor
const { TreblleExceptionFilter, TreblleInterceptor } = treblleNestJS;

// Controller with error handling provided by Treblle
@Controller('api')
@UseFilters(new TreblleExceptionFilter(treblleOptions))
@UseInterceptors(new TreblleInterceptor(treblleOptions))
export class ApiController {
  @Get('users')
  getUsers() {
    // Your API logic here
    return { success: true, data: [/* users data */] };
  }

  @Post('auth/login')
  login(@Body() loginDto: any) {
    // Your authentication logic here
    return { success: true, token: 'sample-token' };
  }
}

// Register the Treblle module and apply middleware
@Module({
  imports: [
    treblleNestJS.TreblleModule.register(treblleOptions)
  ],
  controllers: [ApiController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply body parsers and Treblle middleware in the correct order
    consumer
      .apply(
        express.json(), 
        express.urlencoded({ extended: true }), 
        treblleNestJS.createMiddleware(treblleOptions)
      )
      .forRoutes('*');
  }
}
```

### Option 2: Manual Setup in bootstrap()

For applications that need more control over the middleware setup:

```typescript
import { nestjs as treblleNestJS } from 'treblle-js/integrations';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Define Treblle options
const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN || 'YOUR_SDK_TOKEN',
  apiKey: process.env.TREBLLE_API_KEY || 'YOUR_API_KEY',
  debug: true
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply body parsers first (IMPORTANT)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Apply Treblle middleware after body parsers
  app.use(treblleNestJS.createMiddleware(treblleOptions));
  
  // Apply global exception filter
  app.useGlobalFilters(new treblleNestJS.TreblleExceptionFilter(treblleOptions));
  
  // Apply global interceptor
  app.useGlobalInterceptors(new treblleNestJS.TreblleInterceptor(treblleOptions));
  
  await app.listen(3000);
}
bootstrap();
```

## Integration Components

Treblle provides three main components for NestJS:

1. **Middleware Function** - Created using `createMiddleware()` - Captures request/response data
2. **TreblleExceptionFilter** - Captures errors in controllers
3. **TreblleInterceptor** - Handles errors during request processing

Each component should be configured with the same options to ensure consistent behavior.

## Important: Middleware Order

In NestJS, middleware functions are executed in the order they're added. For Treblle to work correctly, **always ensure body parsing middleware runs before Treblle middleware**.

### ❌ Incorrect Order

```typescript
// Wrong order - Treblle won't capture request bodies
app.use(treblleNestJS.createMiddleware(treblleOptions));
app.use(express.json());
```

### ✅ Correct Order - With middleware consumer

```typescript
// In AppModule
configure(consumer: MiddlewareConsumer) {
  // Apply body parsers and Treblle middleware in correct order
  consumer
    .apply(
      express.json(),
      express.urlencoded({ extended: true }),
      treblleNestJS.createMiddleware(treblleOptions)
    )
    .forRoutes('*');
}
```

### ✅ Correct Order - With app.use()

```typescript
// In bootstrap()
// Correct order - Parse bodies first, then apply Treblle
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(treblleNestJS.createMiddleware(treblleOptions));
```

## Error Handling

Treblle offers two ways to handle errors in NestJS:

### Controller-level Error Handling

```typescript
import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { nestjs as treblleNestJS } from 'treblle-js/integrations';

const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY
};

@Controller('api')
@UseFilters(new treblleNestJS.TreblleExceptionFilter(treblleOptions))
@UseInterceptors(new treblleNestJS.TreblleInterceptor(treblleOptions))
export class ApiController {
  // Controller methods...
}
```

### Global Error Handling

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { nestjs as treblleNestJS } from 'treblle-js/integrations';

const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY
};

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useValue: new treblleNestJS.TreblleExceptionFilter(treblleOptions),
    },
    {
      provide: APP_INTERCEPTOR,
      useValue: new treblleNestJS.TreblleInterceptor(treblleOptions),
    },
  ],
})
export class AppModule {}
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

## Using Environment Variables

For better security, use environment variables:

```typescript
// .env file
TREBLLE_SDK_TOKEN=your_sdk_token
TREBLLE_API_KEY=your_api_key

// app.module.ts
import * as dotenv from 'dotenv';
dotenv.config();

const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY
};
```

## Best Practices

1. **Use Function Middleware**: For the most reliable integration, use `treblleNestJS.createMiddleware(options)` 
2. **Body Parsers First**: Always apply body parsing middleware before Treblle
3. **Error Handling**: Use TreblleExceptionFilter and TreblleInterceptor together for comprehensive error tracking
4. **Environment Configuration**: Use environment variables for sensitive keys
5. **Field Masking**: Configure additional fields to mask with `additionalMaskedFields`
6. **Debugging**: Enable debug mode during development to see detailed logs

Follow these guidelines to ensure Treblle properly monitors your NestJS API with minimal performance impact.

## Troubleshooting

If you're not seeing logs for your API requests, check the following:

1. Ensure debug mode is enabled in your configuration
2. Verify that body parsers are applied before Treblle middleware
3. Confirm that your SDK token and API key are correct
4. Make sure the middleware is correctly applied to your routes
5. Verify that the environment is not in the disabled list

## Support

If you have any questions or issues, please [open an issue](https://github.com/Treblle/treblle-js/issues) or contact the Treblle team.