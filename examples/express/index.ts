/**
 * @file examples/express/index.ts
 * @description Example using Treblle SDK with Express
 */

import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
// Example 1: Using the Treblle class directly
// import Treblle from "treblle-js"; // Import from npm package

// Example 2: Using the Express integration (recommended approach)
import { express as treblleExpress } from "../../dist/integrations";

// Load environment variables
dotenv.config();

// Application error handler
interface ErrorResponse {
    success: boolean;
    error: string;
}

// Initialize Express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Treblle options - now with support for treblle-express style options
const treblleOptions = {
    apiKey: process.env.TREBLLE_API_KEY || "YOUR_TREBLLE_API_KEY",

    sdkToken: process.env.TREBLLE_SDK_TOKEN || "YOUR_TREBLLE_SDK_TOKEN",

    // Additional options
    additionalMaskedFields: ["custom_field"], // Optional custom fields to mask
    debug: process.env.NODE_ENV !== "production", // Enable debug in non-production

    // Path filtering - use either blocklistPaths (treblle-express style) or excludePaths
    blocklistPaths: ["health", "metrics", "api/internal"], // No leading slash needed
    // excludePaths: ["/health", "/metrics", "/api/internal/*"], // Legacy style still works

    // Environment configuration - SDK is enabled by default in all environments
    // Here we're only disabling it in test environment
    environments: {
        disabled: ["test"],
    },
};

// Example 1: Using Treblle class directly
// ----------------------------------------
// const treblle = new Treblle(treblleOptions);
// app.use(treblle.middleware());
// ...later in the middleware chain...
// app.use(treblle.errorHandler());

// Example 2: Using createTreblleMiddleware (legacy approach)
// ---------------------------------------------------------
app.use(treblleExpress.createTreblleMiddleware(treblleOptions));

// Sample API routes
app.get("/api/users", (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 1, name: "John Doe", email: "john@example.com" },
            { id: 2, name: "Jane Smith", email: "jane@example.com" },
        ],
    });
});

app.post("/api/auth/login", (req, res) => {
    // The password field will be automatically masked by Treblle
    const { email, password } = req.body;

    // Sample login logic
    if (email && password) {
        res.json({
            success: true,
            data: {
                user: { id: 1, email },
                token: "sample-jwt-token-would-be-here",
            },
        });
    } else {
        res.status(400).json({
            success: false,
            error: "Email and password are required",
        });
    }
});

// Error handling route
app.get("/api/error", (req, res, next) => {
    // Simulate an error
    const error = new Error("Test error");
    next(error);
});

// Route causing a runtime error
app.get("/api/runtime-error", (req, res) => {
    // This will cause a runtime error
    const undefinedVariable = null;
    // @ts-ignore - Intentional error
    res.json({ result: undefinedVariable.property });
});

// Use Treblle error handler middleware WITHOUT having to pass options again
// This will reuse the instance created by treblle middleware
// IMPORTANT: This must be before your application's error handler
app.use(treblleExpress.createTreblleErrorHandler());

app.use(
    (
        err: Error & { stack?: string },
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ): void => {
        console.error(err.stack);
        const errorResponse: ErrorResponse = {
            success: false,
            error: "Internal Server Error",
        };
        res.status(500).json(errorResponse);
    }
);

// Example 4: Using the all-in-one configuration (alternative)
// -----------------------------------------------------------
// Instead of the separate middleware and error handler, you can use:
// treblleExpress.configureTreblle(app, treblleOptions);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
