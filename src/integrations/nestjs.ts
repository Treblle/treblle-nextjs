/**
 * @file src/integrations/nestjs.ts
 * @description NestJS framework integration for Treblle SDK
 */

import { Injectable, NestMiddleware, Module, DynamicModule, NestInterceptor, ExecutionContext, CallHandler, ArgumentsHost } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Treblle from '../index';
import { TreblleOptions } from '../types';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TreblleInstanceManager } from './instance-manager';

/**
 * Treblle middleware for NestJS
 */
@Injectable()
export class TreblleMiddleware implements NestMiddleware {
  private treblle: Treblle;
  private debug: boolean;
  
  constructor(options?: TreblleOptions) {
    // If options provided directly, use them
    // Otherwise use default instance which should be set during module registration
    if (options) {
      this.treblle = TreblleInstanceManager.getInstance(options, 'NestJS');
      this.debug = options.debug || false;
    } else {
      // Get the default instance that was created during module registration
      this.treblle = TreblleInstanceManager.getDefaultInstance('NestJS');
      this.debug = this.treblle.options?.debug || false;
    }
    
    if (this.debug) {
      console.log(`[Treblle SDK] NestJS: TreblleMiddleware initialized`);
    }
  }
  
  use(req: Request, res: Response, next: NextFunction): void {
    if (this.debug) {
      console.log(`[Treblle SDK] NestJS: Middleware executing for ${req.method} ${req.url}`);
    }
    
    const middleware = this.treblle.middleware();
    
    if (this.debug) {
      console.log(`[Treblle SDK] NestJS: Middleware obtained, now executing it`);
    }
    
    middleware(req, res, next);
    
    if (this.debug) {
      console.log(`[Treblle SDK] NestJS: Middleware passed control to next middleware`);
    }
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
    // Ensure Treblle instance is created and cached
    TreblleInstanceManager.getInstance(options, 'NestJS');
    
    return {
      module: TreblleModule,
      providers: [
        {
          provide: 'TREBLLE_OPTIONS',
          useValue: options,
        },
        {
          provide: TreblleMiddleware,
          useFactory: () => new TreblleMiddleware(options),
        },
        {
          provide: TreblleExceptionFilter,
          useFactory: () => new TreblleExceptionFilter(options),
        },
        {
          provide: TreblleInterceptor,
          useFactory: () => new TreblleInterceptor(options),
        }
      ],
      exports: [TreblleMiddleware, TreblleExceptionFilter, TreblleInterceptor],
      global: true, // Make the module global so components are available everywhere
    };
  }
  
  /**
   * Creates a functional middleware that can be directly used with NestJS
   * consumer.apply() without dependency injection
   * @param options Treblle options
   * @returns Middleware function
   */
  static createMiddleware(options: TreblleOptions): (req: Request, res: Response, next: NextFunction) => void {
    const treblleInstance = TreblleInstanceManager.getInstance(options, 'NestJS');
    const middleware = treblleInstance.middleware();
    
    return (req: Request, res: Response, next: NextFunction) => {
      if (options.debug) {
        console.log(`[Treblle SDK] NestJS: Function middleware executing for ${req.method} ${req.url}`);
      }
      middleware(req, res, next);
    };
  }

  /**
   * Use this module in your AppModule and apply middleware in configure():
   * 
   * @Module({
   *   imports: [TreblleModule.register(options)]
   * })
   * export class AppModule implements NestModule {
   *   configure(consumer: MiddlewareConsumer) {
   *     // Apply Treblle middleware after body parsers
   *     consumer
   *       .apply(express.json(), express.urlencoded({ extended: true }), TreblleMiddleware)
   *       .forRoutes('*');
   *   }
   * }
   */
}

/**
 * Treblle exception filter for NestJS
 */
@Injectable()
export class TreblleExceptionFilter {
  private treblle: Treblle;
  
  constructor(options?: TreblleOptions) {
    if (options) {
      this.treblle = TreblleInstanceManager.getInstance(options, 'NestJS');
    } else {
      this.treblle = TreblleInstanceManager.getDefaultInstance('NestJS');
    }
  }
  
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    
    // Add to treblle errors
    if (!res._treblleErrors) {
      res._treblleErrors = [];
    }
    
    // Process error and add to errors array
    const errorHandler = this.treblle.errorHandler();
    errorHandler(exception, req, res, () => {});
    
    // Handle HTTP exceptions
    const status = exception?.status || exception?.statusCode || 500;
    const message = exception?.message || 'Internal Server Error';
    
    // Respond with proper error format
    const response = exception?.response || { statusCode: status, message };
    
    // Set status and send response (don't throw)
    res.status(status).json(response);
  }
}

/**
 * Treblle interceptor for NestJS
 * Useful for tracking performance even with the built-in NestJS dependency injection system
 */
@Injectable()
export class TreblleInterceptor implements NestInterceptor {
  private readonly treblle: Treblle;

  constructor(options?: TreblleOptions) {
    if (options) {
      this.treblle = TreblleInstanceManager.getInstance(options, 'NestJS');
    } else {
      this.treblle = TreblleInstanceManager.getDefaultInstance('NestJS');
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // We'll let the middleware handle the monitoring
    // This interceptor is mainly for error handling
    return next.handle().pipe(
      catchError(err => {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        
        // Initialize errors array if not exists
        if (!res._treblleErrors) {
          res._treblleErrors = [];
        }
        
        // Process error and add to errors array
        const errorHandler = this.treblle.errorHandler();
        errorHandler(err, req, res, () => {});
        
        // Re-throw the error to allow NestJS to handle it
        return throwError(() => err);
      })
    );
  }
}

/**
 * Alternative usage example in main.ts:
 * 
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   
 *   // Apply body parsers FIRST
 *   app.use(express.json());
 *   app.use(express.urlencoded({ extended: true }));
 *   
 *   // Get the TreblleMiddleware from the module
 *   const treblleMiddleware = app.get(TreblleMiddleware);
 *   
 *   // Apply Treblle middleware AFTER body parsers
 *   app.use(treblleMiddleware.use.bind(treblleMiddleware));
 *   
 *   // Apply global exception filter
 *   const treblleExceptionFilter = app.get(TreblleExceptionFilter);
 *   app.useGlobalFilters(treblleExceptionFilter);
 *   
 *   // Apply global interceptor
 *   const treblleInterceptor = app.get(TreblleInterceptor);
 *   app.useGlobalInterceptors(treblleInterceptor);
 *   
 *   await app.listen(3000);
 * }
 * 
 * Note: The recommended approach is to use the module-based configuration
 * shown in the TreblleModule documentation above.
 */

export default {
  TreblleMiddleware,
  TreblleModule,
  TreblleExceptionFilter,
  TreblleInterceptor,
  createMiddleware: TreblleModule.createMiddleware
};