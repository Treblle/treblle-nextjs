/**
 * @file tests/masking.test.ts
 * @description Tests for the data masking functionality
 */

import { maskSensitiveData } from "../src/masking";
import { DEFAULT_MASKED_FIELDS } from "../src/types";

describe("Data Masking", () => {
    test("should mask sensitive fields", () => {
        const testData = {
            username: "testuser",
            password: "secret123",
            api_key: "sk_test_1234567890",
            data: {
                creditScore: 750,
                normalField: "not-masked",
            },
        };

        const masked = maskSensitiveData(testData);

        // Check that sensitive fields are masked
        expect(masked.password).toBe("*********");
        expect(masked.api_key).toBe("****************");
        expect(masked.data.creditScore).toBe("*****");

        // Check that normal fields are not masked
        expect(masked.username).toBe("testuser");
        expect(masked.data.normalField).toBe("not-masked");
    });

    test("should handle null and undefined values", () => {
        const testData = {
            username: "testuser",
            password: null,
            api_key: undefined,
        };

        const masked = maskSensitiveData(testData);

        // Null and undefined should remain as is
        expect(masked.password).toBe(null);
        expect(masked.api_key).toBe(undefined);
    });

    test("should mask additional fields", () => {
        const testData = {
            username: "testuser",
            password: "secret123",
            customSecret: "very-secret",
            myApiKey: "1234567890",
        };

        const additionalFields = ["customSecret", "myApiKey"];
        const masked = maskSensitiveData(testData, additionalFields);

        // Check that all sensitive fields are masked
        expect(masked.password).toBe("*********");
        expect(masked.customSecret).toBe("***********");
        expect(masked.myApiKey).toBe("**********");
    });

    test("should handle nested objects and arrays", () => {
        const testData = {
            username: "testuser",
            data: {
                password: "secret123",
            },
            items: [{ api_key: "12345" }, { normal: "value" }],
        };

        const masked = maskSensitiveData(testData);

        // Check that nested fields are masked
        expect(masked.data.password).toBe("*********");
        expect(masked.items[0].api_key).toBe("*****");
        expect(masked.items[1].normal).toBe("value");
    });

    test("should handle file objects", () => {
        const fileObj = {
            fieldname: "profile",
            originalname: "profile.jpg",
            encoding: "7bit",
            mimetype: "image/jpeg",
            buffer: Buffer.from("fake image data"),
        };

        const masked = maskSensitiveData(fileObj);

        // Verify file properties are preserved
        expect(masked.fieldname).toBe("profile");
        expect(masked.originalname).toBe("profile.jpg");
        expect(masked.buffer).toBeDefined();
    });
});
