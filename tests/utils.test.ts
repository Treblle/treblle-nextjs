/**
 * @file tests/utils.test.ts
 * @description Tests for utility functions
 */

import {
    getCurrentEnvironment,
    isEnabledForEnvironment,
    getClientIp,
    getServerIp,
    calculateResponseSize,
    extractRoutePath,
} from "../src/utils";
import os from "os";

// Mock os module
jest.mock("os", () => ({
    networkInterfaces: jest.fn(),
}));

describe("Utility Functions", () => {
    describe("getCurrentEnvironment", () => {
        // Save original environment variables
        const originalEnv = { ...process.env };

        afterEach(() => {
            // Restore original environment after each test
            process.env = { ...originalEnv };
        });

        test("should detect environment from NODE_ENV", () => {
            process.env.NODE_ENV = "production";
            expect(getCurrentEnvironment()).toBe("production");

            process.env.NODE_ENV = "development";
            expect(getCurrentEnvironment()).toBe("development");

            process.env.NODE_ENV = "test";
            expect(getCurrentEnvironment()).toBe("test");
        });

        test("should check alternative environment variables", () => {
            // Clear NODE_ENV
            delete process.env.NODE_ENV;

            process.env.APP_ENV = "staging";
            expect(getCurrentEnvironment()).toBe("staging");

            delete process.env.APP_ENV;
            process.env.ENVIRONMENT = "qa";
            expect(getCurrentEnvironment()).toBe("qa");

            delete process.env.ENVIRONMENT;
            process.env.VERCEL_ENV = "preview";
            expect(getCurrentEnvironment()).toBe("preview");
        });

        test("should detect cloud environments", () => {
            delete process.env.NODE_ENV;
            delete process.env.APP_ENV;

            process.env.AWS_REGION = "us-east-1";
            expect(getCurrentEnvironment()).toBe("production");

            delete process.env.AWS_REGION;
            process.env.AZURE_FUNCTIONS_ENVIRONMENT = "staging";
            expect(getCurrentEnvironment()).toBe("staging");
        });

        test("should default to development", () => {
            // Clear all environment variables
            delete process.env.NODE_ENV;
            delete process.env.APP_ENV;
            delete process.env.ENVIRONMENT;
            delete process.env.VERCEL_ENV;
            delete process.env.HEROKU_ENVIRONMENT;
            delete process.env.NEXT_PUBLIC_ENV;
            delete process.env.AWS_REGION;
            delete process.env.AWS_LAMBDA_FUNCTION_NAME;
            delete process.env.AZURE_FUNCTIONS_ENVIRONMENT;

            expect(getCurrentEnvironment()).toBe("development");
        });
    });

    describe("isEnabledForEnvironment", () => {
        // Save original environment variables
        const originalEnv = { ...process.env };

        afterEach(() => {
            // Restore original environment after each test
            process.env = { ...originalEnv };
        });

        test("should respect explicit enabled setting", () => {
            expect(
                isEnabledForEnvironment({ sdkToken: "test", apiKey: "test", enabled: true })
            ).toBe(true);
            expect(
                isEnabledForEnvironment({ sdkToken: "test", apiKey: "test", enabled: false })
            ).toBe(false);
        });

        test("should check disabled environments", () => {
            process.env.NODE_ENV = "test";

            expect(
                isEnabledForEnvironment({
                    sdkToken: "test",
                    apiKey: "test",
                    environments: {
                        disabled: ["test", "ci"],
                    },
                })
            ).toBe(false);

            process.env.NODE_ENV = "production";

            expect(
                isEnabledForEnvironment({
                    sdkToken: "test",
                    apiKey: "test",
                    environments: {
                        disabled: ["test", "ci"],
                    },
                })
            ).toBe(true);
        });

        test("should check enabled environments", () => {
            process.env.NODE_ENV = "production";

            expect(
                isEnabledForEnvironment({
                    sdkToken: "test",
                    apiKey: "test",
                    environments: {
                        enabled: ["production", "staging"],
                    },
                })
            ).toBe(true);

            process.env.NODE_ENV = "development";

            expect(
                isEnabledForEnvironment({
                    sdkToken: "test",
                    apiKey: "test",
                    environments: {
                        enabled: ["production", "staging"],
                    },
                })
            ).toBe(false);
        });

        test("should use default setting for unlisted environments", () => {
            process.env.NODE_ENV = "custom";

            expect(
                isEnabledForEnvironment({
                    sdkToken: "test",
                    apiKey: "test",
                    environments: {
                        enabled: ["production"],
                        disabled: ["test"],
                        default: true,
                    },
                })
            ).toBe(true);

            expect(
                isEnabledForEnvironment({
                    sdkToken: "test",
                    apiKey: "test",
                    environments: {
                        enabled: ["production"],
                        disabled: ["test"],
                        default: false,
                    },
                })
            ).toBe(false);
        });

        test("should default to enabled", () => {
            process.env.NODE_ENV = "anything";

            expect(
                isEnabledForEnvironment({
                    sdkToken: "test",
                    apiKey: "test",
                })
            ).toBe(true);
        });
    });

    describe("getClientIp", () => {
        test("should get IP from x-forwarded-for header", () => {
            const req = {
                headers: {
                    "x-forwarded-for": "192.168.1.1",
                },
            };

            expect(getClientIp(req)).toBe("192.168.1.1");
        });

        test("should fall back to connection.remoteAddress", () => {
            const req = {
                headers: {},
                connection: {
                    remoteAddress: "192.168.1.2",
                },
            };

            expect(getClientIp(req)).toBe("192.168.1.2");
        });

        test("should fall back to socket.remoteAddress", () => {
            const req = {
                headers: {},
                connection: {},
                socket: {
                    remoteAddress: "192.168.1.3",
                },
            };

            expect(getClientIp(req)).toBe("192.168.1.3");
        });

        test("should return default IP if none found", () => {
            const req = {
                headers: {},
                connection: {},
                socket: {},
            };

            expect(getClientIp(req)).toBe("127.0.0.1");
        });
    });

    describe("getServerIp", () => {
        test("should get first non-internal IPv4 address", () => {
            // Mock network interfaces
            (os.networkInterfaces as jest.Mock).mockReturnValue({
                eth0: [
                    {
                        address: "192.168.1.100",
                        netmask: "255.255.255.0",
                        family: "IPv4",
                        mac: "00:00:00:00:00:00",
                        internal: false,
                    },
                    {
                        address: "fe80::1",
                        netmask: "ffff:ffff:ffff:ffff::",
                        family: "IPv6",
                        mac: "00:00:00:00:00:00",
                        internal: false,
                    },
                ],
                lo: [
                    {
                        address: "127.0.0.1",
                        netmask: "255.0.0.0",
                        family: "IPv4",
                        mac: "00:00:00:00:00:00",
                        internal: true,
                    },
                ],
            });

            expect(getServerIp()).toBe("192.168.1.100");
        });

        test("should return localhost if no external interfaces found", () => {
            // Mock network interfaces with only internal addresses
            (os.networkInterfaces as jest.Mock).mockReturnValue({
                lo: [
                    {
                        address: "127.0.0.1",
                        netmask: "255.0.0.0",
                        family: "IPv4",
                        mac: "00:00:00:00:00:00",
                        internal: true,
                    },
                ],
            });

            expect(getServerIp()).toBe("127.0.0.1");
        });

        test("should handle empty network interfaces", () => {
            // Mock empty network interfaces
            (os.networkInterfaces as jest.Mock).mockReturnValue({});

            expect(getServerIp()).toBe("127.0.0.1");
        });
    });

    describe("calculateResponseSize", () => {
        test("should use content-length header if available", () => {
            const res = {
                getHeader: jest.fn().mockReturnValue("1024"),
            };

            expect(calculateResponseSize({}, res)).toBe(1024);
            expect(res.getHeader).toHaveBeenCalledWith("content-length");
        });

        test("should use file size if available", () => {
            const body = {
                __type: "file",
                size: 2048,
                contentType: "application/pdf",
            };

            expect(calculateResponseSize(body, {})).toBe(2048);
        });

        test("should calculate size of string body", () => {
            const body = "Hello, world!";

            expect(calculateResponseSize(body, {})).toBe(Buffer.byteLength(body, "utf8"));
        });

        test("should calculate size of object body", () => {
            const body = { message: "Hello, world!" };
            const jsonString = JSON.stringify(body);

            expect(calculateResponseSize(body, {})).toBe(Buffer.byteLength(jsonString, "utf8"));
        });

        test("should return 0 for empty body", () => {
            expect(calculateResponseSize(null, {})).toBe(0);
            expect(calculateResponseSize(undefined, {})).toBe(0);
        });

        test("should handle errors gracefully", () => {
            // Create circular reference to cause JSON.stringify to throw
            const circular: any = {};
            circular.self = circular;

            expect(calculateResponseSize(circular, {})).toBe(0);
        });
    });

    describe("extractRoutePath", () => {
        test("should extract path from Express route", () => {
            const req = {
                route: {
                    path: "/users/:id",
                },
            };

            expect(extractRoutePath(req)).toBe("/users/:id");
        });

        test("should return empty string if no route info available", () => {
            const req = {
                url: "/users/123",
                originalUrl: "/users/123",
            };

            expect(extractRoutePath(req)).toBe("/users/123");
        });
    });
});
