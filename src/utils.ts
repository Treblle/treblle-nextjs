/**
 * @file src/utils.ts
 * @description Utility functions for Treblle SDK
 */

import { TreblleOptions } from "./types";
import os from "os";

/**
 * @function getCurrentEnvironment
 * @description Detect the current environment
 * @returns Environment name
 */
export function getCurrentEnvironment(): string {
    // 1. Check NODE_ENV environment variable (most common)
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv) {
        return nodeEnv.toLowerCase();
    }

    // 2. Check for other common environment variables
    if (process.env.APP_ENV) {
        return process.env.APP_ENV.toLowerCase();
    }

    if (process.env.ENVIRONMENT) {
        return process.env.ENVIRONMENT.toLowerCase();
    }

    // 3. Check for cloud provider environment variables
    if (process.env.VERCEL_ENV) {
        return process.env.VERCEL_ENV.toLowerCase();
    }

    if (process.env.HEROKU_ENVIRONMENT) {
        return process.env.HEROKU_ENVIRONMENT.toLowerCase();
    }

    // 4. Check framework-specific environment variables
    if (process.env.NEXT_PUBLIC_ENV) {
        return process.env.NEXT_PUBLIC_ENV.toLowerCase();
    }

    // 5. Check common cloud environment indicators
    if (process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return "production"; // Assume AWS Lambda is production unless otherwise specified
    }

    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT) {
        return process.env.AZURE_FUNCTIONS_ENVIRONMENT.toLowerCase();
    }

    // Default to development if no environment is detected
    return "development";
}

/**
 * @function isEnabledForEnvironment
 * @description Determine if the SDK should be enabled for the current environment
 * @param config - Configuration object
 * @returns Whether the SDK should be enabled
 */
export function isEnabledForEnvironment(config: TreblleOptions): boolean {
    // If explicitly enabled/disabled via config, respect that setting
    if (typeof config.enabled === "boolean") {
        return config.enabled;
    }

    // Get current environment
    const currentEnv = getCurrentEnvironment();

    // Check environment-specific settings
    if (config.environments) {
        // If it's an object with specific settings
        if (typeof config.environments === "object") {
            // Check if current environment is in the disabled list
            if (
                Array.isArray(config.environments.disabled) &&
                config.environments.disabled.includes(currentEnv)
            ) {
                return false;
            }

            // Check if environment is explicitly enabled
            if (
                Array.isArray(config.environments.enabled) &&
                config.environments.enabled.length > 0
            ) {
                // If the current environment is in the enabled list, return true
                if (config.environments.enabled.includes(currentEnv)) {
                    return true;
                }

                // If current env is not in enabled list but there is an explicit enabled list,
                // return false unless there's a default override
                if (typeof config.environments.default === "boolean") {
                    return config.environments.default;
                }
                return false;
            }

            // If there's no enabled list but there is a default setting, use that
            if (typeof config.environments.default === "boolean") {
                return config.environments.default;
            }
        }

        // If it's a boolean, use it directly
        if (typeof config.environments === "boolean") {
            return config.environments;
        }
    }

    // Default to enabled for all environments
    return true;
}

/**
 * @function getClientIp
 * @description Gets the client IP address
 * @param req - Express request object
 * @returns Client IP address
 */
export function getClientIp(req: any): string {
    return (
        req.headers["x-forwarded-for"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress ||
        "127.0.0.1"
    );
}

/**
 * @function getServerIp
 * @description Gets the server IP address
 * @returns Server IP address
 */
export function getServerIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const networkInterface = interfaces[name];
        if (networkInterface) {
            for (const iface of networkInterface) {
                // Skip internal and non-IPv4 addresses
                if (iface.family === "IPv4" && !iface.internal) {
                    return iface.address;
                }
            }
        }
    }
    return "127.0.0.1";
}

/**
 * @function calculateResponseSize
 * @description Calculate the size of the response in bytes
 * @param body - Response body
 * @param res - Express response object
 * @returns Size in bytes
 */
export function calculateResponseSize(body: any, res: any): number {
    try {
        // If Content-Length header is available, use it
        if (res && res.getHeader && res.getHeader("content-length")) {
            return parseInt(res.getHeader("content-length") as string, 10);
        }

        // If body is a file or binary placeholder, use the size if available
        if (
            body &&
            typeof body === "object" &&
            (body.__type === "file" || body.__type === "binary") &&
            body.size
        ) {
            return body.size;
        }

        // For empty or null body
        if (!body) return 0;

        // For string bodies
        if (typeof body === "string") {
            return Buffer.byteLength(body, "utf8");
        }

        // For objects, convert to JSON string and measure
        if (typeof body === "object") {
            const jsonString = JSON.stringify(body);
            return Buffer.byteLength(jsonString, "utf8");
        }

        // Default for other types
        return 0;
    } catch (error) {
        // Silently handle errors and return 0
        return 0;
    }
}

/**
 * @function extractRoutePath
 * @description Extract the route path pattern from the request
 * @param req - Express request object
 * @returns Route path pattern or original URL path if route not available
 */
export function extractRoutePath(req: any): string {
    // Try various ways to get the route pattern

    // 1. Direct access to Express route (most common approach)
    if (req.route && req.route.path) {
        // Get the base path from the route
        let basePath = req.route.path;

        // Check if there's a baseUrl to prepend (for routers with a base path)
        if (req.baseUrl) {
            return `${req.baseUrl}${basePath}`;
        }

        return basePath;
    }

    // 2. Check for route path in Express 4.x
    if (req._parsedUrl && req.url) {
        try {
            // Try to extract the route by removing query parameters
            const pathWithoutQuery = req.url.split("?")[0];

            // If we have router base path, include it
            if (req.baseUrl) {
                return `${req.baseUrl}${pathWithoutQuery}`;
            }

            return pathWithoutQuery;
        } catch (e) {
            // If parsing fails, continue to next approach
        }
    }

    // 3. Access router stack (more complex but can work in some Express setups)
    if (req.app && req.app._router && req.app._router.stack) {
        try {
            const url = req.originalUrl || req.url;
            const method = req.method.toLowerCase();

            // Find matching route in the router stack
            for (const layer of req.app._router.stack) {
                if (layer.route) {
                    const routePath = layer.route.path;
                    const routeMethods = Object.keys(layer.route.methods);

                    // Check if this route matches our URL pattern and method
                    if (routeMethods.includes(method)) {
                        // Simple matching for exact routes
                        if (routePath === url) {
                            return routePath;
                        }

                        // Check for parametrized routes (/:id pattern)
                        if (routePath.includes(":") && layer.regexp) {
                            const match = layer.regexp.test(url);
                            if (match) {
                                return routePath;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // If router stack parsing fails, continue to next approach
        }
    }

    // 4. For NestJS applications
    if (req.params && Object.keys(req.params).length > 0) {
        // Try to reconstruct the route path from current URL and params
        let path = req.originalUrl || req.url;

        // Remove query string if present
        path = path.split("?")[0];

        // Replace actual parameter values with parameter placeholders
        for (const [paramName, paramValue] of Object.entries(req.params)) {
            if (typeof paramValue === "string") {
                path = path.replace(paramValue, `:${paramName}`);
            }
        }

        return path;
    }

    // 5. Last resort: Return the URL path without query parameters
    // This at least gives us something useful rather than an empty string
    if (req.originalUrl || req.url) {
        const urlPath = (req.originalUrl || req.url).split("?")[0];
        return urlPath;
    }

    // If all else fails, return the original URL or an empty string
    return req.originalUrl || req.url || "";
}
