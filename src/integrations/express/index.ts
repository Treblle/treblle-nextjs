/**
 * @file src/integrations/express.ts
 * @description Express framework integration for Treblle SDK
 */

import { RequestHandler, ErrorRequestHandler } from "express";
import Treblle from "../../index";
import { TreblleOptions } from "../../types";

// Store instances by config hash to avoid creating duplicate instances
const instances = new Map<string, Treblle>();

/**
 * Helper to get or create a Treblle instance based on config
 * @param options - Treblle configuration options
 * @returns Treblle instance
 */
function getTreblleInstance(options: TreblleOptions): Treblle {
    // Create a simple hash of the options object
    const hash = JSON.stringify({
        sdkToken: options.sdkToken,
        apiKey: options.apiKey,
        debug: options.debug,
        enabled: options.enabled,
        environments: options.environments,
        additionalMaskedFields: options.additionalMaskedFields,
        blocklistPaths: options.blocklistPaths || options.excludePaths,
        includePaths: options.includePaths,
    });

    // Check if we already have an instance with these options
    if (!instances.has(hash)) {
        instances.set(hash, new Treblle(options));
    }

    return instances.get(hash)!;
}

/**
 * @function treblle
 * @description Creates Express middleware for Treblle monitoring (matches treblle-express API)
 * @param options - Treblle configuration options
 * @returns Express middleware function
 */
export function treblle(options: TreblleOptions): RequestHandler {
    const treblleInstance = getTreblleInstance(options);
    return treblleInstance.middleware() as RequestHandler;
}

/**
 * @function createTreblleMiddleware
 * @description Legacy alias for treblle function
 * @param options - Treblle configuration options
 * @returns Express middleware function
 */
export function createTreblleMiddleware(options: TreblleOptions): RequestHandler {
    return treblle(options);
}

/**
 * @function createTreblleErrorHandler
 * @description Creates Express error handler middleware for Treblle
 * @param options - Treblle configuration options (optional if middleware was created first)
 * @returns Express error middleware function
 */
export function createTreblleErrorHandler(options?: TreblleOptions): ErrorRequestHandler {
    // If no options provided, use the most recently created instance
    let treblleInstance: Treblle;

    if (options) {
        treblleInstance = getTreblleInstance(options);
    } else {
        // If no options provided but instances exist, use the latest instance
        if (instances.size === 0) {
            throw new Error(
                "No Treblle instance found. Create middleware first or provide options."
            );
        }
        // Get the last created instance
        treblleInstance = Array.from(instances.values())[instances.size - 1];
    }

    return treblleInstance.errorHandler() as ErrorRequestHandler;
}

/**
 * Express application extension to configure Treblle
 * @param app - Express application instance
 * @param options - Treblle configuration options
 */
export function configureTreblle(app: any, options: TreblleOptions): void {
    const treblleInstance = getTreblleInstance(options);

    // Apply Treblle middleware globally
    app.use(treblleInstance.middleware() as RequestHandler);

    // Apply Treblle error handler
    app.use(treblleInstance.errorHandler() as ErrorRequestHandler);
}

/**
 * Helper function to apply Treblle to specific routes
 * @param options - Treblle configuration options
 * @returns RequestHandler middleware
 */
export function applyTreblleToRoutes(options: TreblleOptions): RequestHandler {
    return treblle(options);
}

/**
 * @name TreblleMiddleware
 * @description Class-based middleware compatible with Express
 */
export class TreblleMiddleware {
    private treblleInstance: Treblle;

    constructor(options: TreblleOptions) {
        this.treblleInstance = getTreblleInstance(options);
    }

    use(req: any, res: any, next: any): void {
        const middleware = this.treblleInstance.middleware();
        middleware(req, res, next);
    }

    handleError(err: Error, req: any, res: any, next: any): void {
        const errorHandler = this.treblleInstance.errorHandler();
        errorHandler(err, req, res, next);
    }
}

// Default export with all Express integration functions
export default {
    treblle,
    createTreblleMiddleware,
    createTreblleErrorHandler,
    configureTreblle,
    applyTreblleToRoutes,
    TreblleMiddleware,
};
