/**
 * @file examples/nestjs-example.ts
 * @description Example using Treblle SDK with NestJS
 */

import 'reflect-metadata';
import { Module, NestModule, MiddlewareConsumer, Controller, Get, Post, Body } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { nestjs as treblleNestJS } from '../src/integrations'; // In your project, use 'treblle-js/integrations'

// Destructure TreblleModule along with other classes
const { TreblleModule, TreblleExceptionFilter, TreblleInterceptor } = treblleNestJS;

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
  // Using definite-assignment assertion (!) because DTOs are populated via NestJS validation pipe, not constructor
  email!: string;
  password!: string;
}

//============================================================================
// Example 1: Recommended approach - Module registration with middleware chaining
//============================================================================


// Controller with sample endpoints
@Controller('api')
class ApiController {
  @Get('users')
  getUsers(): any {
    return {
      success: true,
      data: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
      ]
    };
  }

  @Post('auth/login')
  login(@Body() loginDto: LoginDto): any {
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
  throwError(): void {
    throw new Error('Test error');
  }

  @Get('runtime-error')
  runtimeError(): any {
    const undefinedVariable = null;
    // @ts-ignore - Intentional error
    return { result: undefinedVariable.property };
  }
}


// Register the Treblle module
@Module({
  imports: [
    TreblleModule.register(treblleOptions) // All components share the same Treblle instance
  ],
  controllers: [ApiController],
  providers: [
    // TreblleExceptionFilter and TreblleInterceptor are automatically provided by TreblleModule
  ]
})
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Use the pre-built middleware function 
    consumer
      .apply(
        express.json(), 
        express.urlencoded({ extended: true }), 
        treblleNestJS.createMiddleware(treblleOptions)
      )
      .forRoutes('*');
  }
}

//============================================================================
// Example 2: Alternative approach - Manual setup in bootstrap
//============================================================================
// 
// @Module({
//   imports: [TreblleModule.register(treblleOptions)],
//   controllers: [ApiController]
// })
// class AppModule {}
// 
// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   
//   // Apply body parsers first
//   app.use(express.json());
//   app.use(express.urlencoded({ extended: true }));
//   
//   // Apply treblle middleware after body parsers
//   const treblleMiddleware = app.get(TreblleMiddleware);
//   app.use(treblleMiddleware.use.bind(treblleMiddleware));
//   
//   // Apply global exception filter
//   const treblleExceptionFilter = app.get(TreblleExceptionFilter);
//   app.useGlobalFilters(treblleExceptionFilter);
//   
//   // Apply global interceptor - get the existing instance from the container
//   const treblleInterceptor = app.get(TreblleInterceptor);
//   app.useGlobalInterceptors(treblleInterceptor);
//   
//   await app.listen(3000);
// }

// Bootstrap the application
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();