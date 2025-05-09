/**
 * @file src/constants/index.ts
 * @description Constants used in the Treblle SDK
 */

let resolvedTreblleEndpoints: string[];

// Check for staging environment
// process.env.NODE_ENV is the standard way to check environment in Node.js
if (process.env.NODE_ENV === "staging") {
    resolvedTreblleEndpoints = ["https://gateway-v3-dev.treblle.com"];
} else {
    resolvedTreblleEndpoints = [
        "https://rocknrolla.treblle.com",
        "https://punisher.treblle.com",
        "https://sicario.treblle.com",
    ];
}

export const TREBLLE_ENDPOINTS = resolvedTreblleEndpoints;

export const DEFAULT_MASKED_FIELDS = [
    "password",
    "pwd",
    "secret",
    "password_confirmation",
    "passwordConfirmation",
    "cc",
    "card_number",
    "cardNumber",
    "ccv",
    "ssn",
    "credit_score",
    "creditScore",
    "api_key",
];
