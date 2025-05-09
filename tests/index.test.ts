/**
 * @file tests/index.test.ts
 * @description Tests for the core Treblle SDK functionality
 */

import Treblle from "../src";
import https from "https";
import { Request, Response } from "express";

// Mock https module
jest.mock("https", () => ({
    request: jest.fn().mockImplementation(() => ({
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        write: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn(),
    })),
}));

describe("Treblle SDK", () => {
    let treblle: Treblle;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
        // Reset console.error mock
        console.error = jest.fn();

        // Create Treblle instance
        treblle = new Treblle({
            sdkToken: "test-sdk-token",
            apiKey: "test-api-key",
            debug: true,
        });

        // Mock request object
        mockReq = {
            method: "GET",
            protocol: "http",
            originalUrl: "/api/test",
            connection: { remoteAddress: "127.0.0.1" } as any,
            socket: {} as any,
            headers: {
                host: "localhost:3000",
                "user-agent": "Jest Test",
            },
            body: {
                test: "value",
                password: "secret123",
            },
            get: jest.fn().mockImplementation((key) => (mockReq.headers as any)[key.toLowerCase()]),
        };

        // Mock response object
        mockRes = {
            statusCode: 200,
            getHeaders: jest.fn().mockReturnValue({}),
            getHeader: jest.fn(),
            send: jest.fn(function (this: any, body) {
                return this;
            }),
            json: jest.fn(function (this: any, body) {
                return this;
            }),
            end: jest.fn(function (this: any, chunk) {
                return this;
            }),
            on: jest.fn(),
        };

        // Mock next function
        mockNext = jest.fn();
    });

    test("should initialize with correct config", () => {
        expect((treblle as any).sdkToken).toBe("test-sdk-token");
        expect((treblle as any).apiKey).toBe("test-api-key");
        expect((treblle as any).debug).toBe(true);
    });

    test("should handle missing SDK token", () => {
        const invalidTreblle = new Treblle({
            apiKey: "test-api-key",
        } as any);

        expect(console.error).toHaveBeenCalled();
        expect((console.error as jest.Mock).mock.calls[0][0]).toContain("[Treblle SDK Error]");
    });

    test("should create middleware function", () => {
        const middleware = treblle.middleware();
        expect(typeof middleware).toBe("function");

        // Call middleware
        middleware(mockReq as Request, mockRes as Response, mockNext);

        // Next should be called
        expect(mockNext).toHaveBeenCalled();
    });

    test("should handle errors in errorHandler", () => {
        const errorHandler = treblle.errorHandler();
        const error = new Error("Test error");

        // Initialize res._treblleErrors
        (mockRes as any)._treblleErrors = [];

        // Call error handler
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        // Error should be added to _treblleErrors
        expect((mockRes as any)._treblleErrors.length).toBe(1);
        expect((mockRes as any)._treblleErrors[0].message).toBe("Test error");

        // Next should be called with error
        expect(mockNext).toHaveBeenCalledWith(error);
    });

    test("should respect environment settings", () => {
        // Save original NODE_ENV
        const originalNodeEnv = process.env.NODE_ENV;

        // Test with enabled: false
        const treblleDisabled = new Treblle({
            sdkToken: "test-sdk-token",
            apiKey: "test-api-key",
            enabled: false,
        });

        expect((treblleDisabled as any).enabled).toBe(false);

        // Test with environments.disabled
        process.env.NODE_ENV = "test";

        const treblleWithDisabledEnv = new Treblle({
            sdkToken: "test-sdk-token",
            apiKey: "test-api-key",
            environments: {
                disabled: ["test"],
            },
        });

        expect((treblleWithDisabledEnv as any).enabled).toBe(false);

        // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
    });

    test("should handle path exclusion", () => {
        const treblleWithExcludePaths = new Treblle({
            sdkToken: "test-sdk-token",
            apiKey: "test-api-key",
            excludePaths: ["/health", "/api/internal/*"],
        });

        // Test with excluded path
        mockReq.originalUrl = "/health";

        const middleware = treblleWithExcludePaths.middleware();
        middleware(mockReq as Request, mockRes as Response, mockNext);

        // Next should be called without processing
        expect(mockNext).toHaveBeenCalled();
        expect((mockRes as any).send).not.toHaveBeenCalled();
    });
});
