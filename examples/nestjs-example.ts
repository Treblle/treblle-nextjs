/**
 * @file examples/nestjs-example.ts
 * @description Example using Treblle SDK with NestJS
 */

import { Module, NestModule, MiddlewareConsumer, Controller, Get, Post, Body, UseFilters, HttpStatus } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Request, Response } from 'express';
import { nestjs as treblleNestJS } from '../src/integrations'; // In your project, use 'treblle-sdk/integrations'

// Configuration for Treblle
const treblleOptions = {
  sdkToken: process.env.TREBLLE_SDK_TOKEN || 'YOUR_SDK_TOKEN',
  apiKey: process.env.TREBLLE_API_KEY || 'YOUR_API_KEY',
  additionalMaskedFields: ['password'],
  debug: process.env.NODE_ENV !== 'production',
  environments: {
    disabled: ['test']
  }
};

// User DTO
class LoginDto {
  email: string;
  password: string;
}

// Create the Treblle exception filter
const treblleExceptionFilter = new treblleNestJS.TreblleExceptionFilter(treblleOptions);

// Controller with sample endpoints
@Controller('api')
@UseFilters(treblleExceptionFilter)
class ApiController {
  @Get('users')
  getUsers() {
    return {
      success: true,
      data: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
      ]
    };
  }

  @Post('auth/login')
  login(@Body() loginDto: LoginDto) {
    // The password field will be automatically masked by Treblle
    if (loginDto.email && loginDto.password) {
      return {
        success: true,
        data: {
          user: { id: 1, email: loginDto.email },
          token: 'sample-jwt-token-would-be-here'
        }
      };
    } else {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }
  }

  @Get('error')
  throwError() {
    throw new Error('Test error');
  }

  @Get('runtime-error')
  runtimeError() {
    const undefinedVariable = null;
    // @ts-ignore - Intentional error
    return { result: undefinedVariable.property };
  }
}

// Register the Treblle module
@Module({
  imports: [
    treblleNestJS.TreblleModule.register(treblleOptions)
  ],
  controllers: [ApiController]
})
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply Treblle middleware to all routes
    consumer
      .apply(treblleNestJS.TreblleMiddleware)
      .forRoutes('*');
  }
}

// Bootstrap the application
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();