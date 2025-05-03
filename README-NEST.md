# Treblle SDK for NestJS Integration

This guide explains how to integrate Treblle with your NestJS applications to monitor API requests in real-time with precise microsecond timing.

## Installation

```bash
npm install treblle-js --save
```

## Quick Start (Simplified Integration)

The Treblle SDK now provides a simplified integration for NestJS with shared configuration between middleware and error handlers.

### Option 1: Using the Module System (Recommended)

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { Controller, Get, Post, Body, UseFilters, UseInterceptors } from '@nestjs/common';
import * as express from 'express';
import { nestjs as treblleNestJS } from 'treblle-js/integrations';

// Define Treblle options once
const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY,
  additionalMaskedFields: ['password'],
  debug: process.env.NODE_ENV !== 'production',
  environments: {
    disabled: ['test']
  }
};

// Controller with error handling provided by Treblle
@Controller('api')
@UseFilters(treblleNestJS.TreblleExceptionFilter) // Uses shared instance from module
@UseInterceptors(treblleNestJS.TreblleInterceptor) // Uses shared instance from module
export class ApiController {
  @Get('users')
  getUsers() {
    // API logic
  }

  @Post('auth/login')
  login(@Body() loginDto: any) {
    // API logic
  }
}

// Root module with Treblle registration
@Module({
  imports: [
    treblleNestJS.TreblleModule.register(treblleOptions) // Global module with shared configuration
  ],
  controllers: [ApiController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply body parsers followed by Treblle middleware
    consumer
      .apply(
        express.json(),
        express.urlencoded({ extended: true }),
        treblleNestJS.TreblleMiddleware
      )
      .forRoutes('*');
  }
}
```

### Option 2: Manual Setup (Alternative)

```typescript
import { nestjs as treblleNestJS } from 'treblle-js/integrations';

// Define Treblle options once
const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY
};

// Create middleware with options
// This also creates and stores a default instance for other components
const treblleMiddleware = new treblleNestJS.TreblleMiddleware(treblleOptions);

// Create exception filter and interceptor WITHOUT options
// They will automatically use the default instance created by middleware
const treblleExceptionFilter = new treblleNestJS.TreblleExceptionFilter();
const treblleInterceptor = new treblleNestJS.TreblleInterceptor();

// Use in controller
@Controller('api')
@UseFilters(treblleExceptionFilter)
@UseInterceptors(treblleInterceptor)
export class ApiController {
  // Controller methods...
}
```

## Integration Components

Treblle provides three main components for NestJS:

1. **TreblleMiddleware** - Captures request/response data
2. **TreblleExceptionFilter** - Captures errors in controllers
3. **TreblleInterceptor** - Handles errors during request processing

The updated SDK allows these components to share configuration, so you only need to provide options once.

## Important: Middleware Order

In NestJS, middleware functions are executed in the order they're added. For Treblle to work correctly, **always ensure body parsing middleware runs before Treblle middleware**.

### ❌ Incorrect Order

```typescript
// Wrong order - Treblle won't capture request bodies
app.use(treblleMiddleware.use.bind(treblleMiddleware));
app.use(express.json());
```

### ✅ Correct Order - Option 1: With middleware consumer

```typescript
// In AppModule
configure(consumer: MiddlewareConsumer) {
  // Apply body parsers and Treblle middleware in correct order
  consumer
    .apply(
      express.json(),
      express.urlencoded({ extended: true }),
      TreblleMiddleware
    )
    .forRoutes('*');
}
```

### ✅ Correct Order - Option 2: With app.use()

```typescript
// In bootstrap()
// Correct order - Parse bodies first, then apply Treblle
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(treblleMiddleware.use.bind(treblleMiddleware));
```

## Global Integration in NestJS

Add Treblle to your `main.ts` file:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import { TreblleMiddleware } from 'treblle-js/integrations/nestjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. Parse request bodies FIRST
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // 2. Get Treblle middleware from the module
  const treblleMiddleware = app.get(TreblleMiddleware);
  
  // 3. Apply Treblle middleware AFTER body parsers
  app.use(treblleMiddleware.use.bind(treblleMiddleware));
  
  await app.listen(3000);
}
bootstrap();
```

## Module-based Integration

For a more granular approach, you can apply Treblle to specific modules:

1. Register the Treblle module in your `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { nestjs as treblleNestJS } from 'treblle-js/integrations';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    treblleNestJS.TreblleModule.register({
      sdkToken: 'YOUR_SDK_TOKEN',
      apiKey: 'YOUR_API_KEY',
      additionalMaskedFields: ['custom_field_to_mask'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

2. Implement `NestModule` in your module to apply middleware to specific routes:

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { nestjs as treblleNestJS } from 'treblle-js/integrations';
import { UserController } from './user.controller';

@Module({
  controllers: [UserController],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply Treblle to all routes in UserController
    consumer
      .apply(treblleNestJS.TreblleMiddleware)
      .forRoutes(UserController);
  }
}
```

## Error Handling with TreblleExceptionFilter

To capture errors in your NestJS application:

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { nestjs as treblleNestJS } from 'treblle-js/integrations';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: treblleNestJS.TreblleExceptionFilter, // No need to pass options if middleware is used
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

1. **Body Parsers First**: Always apply body parsing middleware before Treblle
2. **Error Handling**: Use TreblleExceptionFilter to capture errors
3. **Environment Configuration**: Use environment variables for sensitive keys
4. **Field Masking**: Configure additional fields to mask with `additionalMaskedFields`
5. **Shared Configuration**: Use the module system to share config between components

Follow these guidelines to ensure Treblle properly monitors your NestJS API with minimal performance impact.

## Support

If you have any questions or issues, please [open an issue](https://github.com/Treblle/treblle-js/issues) or contact the Treblle team.