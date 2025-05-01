/**
 * @file src/integrations/nestjs.ts
 * @description NestJS framework integration for Treblle SDK
 */

import { Injectable, NestMiddleware, Module, DynamicModule } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Treblle from '../index';
import { TreblleOptions } from '../types';

/**
 * Treblle middleware for NestJS
 */
@Injectable()
export class TreblleMiddleware implements NestMiddleware {
  private treblle: Treblle;
  
  constructor(options: TreblleOptions) {
    this.treblle = new Treblle(options);
  }
  
  use(req: Request, res: Response, next: NextFunction): void {
    return this.treblle.middleware()(req, res, next);
  }
}

/**
 * Treblle module for NestJS
 */
@Module({})
export class TreblleModule {
  /**
   * Register Treblle module with options
   * @param options - Treblle configuration options
   * @returns Dynamic module
   */
  static register(options: TreblleOptions): DynamicModule {
    return {
      module: TreblleModule,
      providers: [
        {
          provide: TreblleMiddleware,
          useFactory: () => new TreblleMiddleware(options),
        },
      ],
      exports: [TreblleMiddleware],
    };
  }
}

/**
 * Treblle exception filter for NestJS
 */
@Injectable()
export class TreblleExceptionFilter {
  private treblle: Treblle;
  
  constructor(options: TreblleOptions) {
    this.treblle = new Treblle(options);
  }
  
  catch(exception: Error, host: any): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    
    // Add to treblle errors
    if (!res._treblleErrors) {
      res._treblleErrors = [];
    }
    
    // Process error and add to errors array
    const errorHandler = this.treblle.errorHandler();
    errorHandler(exception, req, res, () => {});
    
    // Continue with nest's error handling
    throw exception;
  }
}

export default {
  TreblleMiddleware,
  TreblleModule,
  TreblleExceptionFilter
};