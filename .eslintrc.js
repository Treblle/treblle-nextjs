module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "tsconfig.json",
        sourceType: "module",
        ecmaVersion: 2020,
    },
    plugins: ["@typescript-eslint/eslint-plugin", "prettier", "jest"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
        "plugin:jest/recommended",
    ],
    root: true,
    env: {
        node: true,
        jest: true,
    },
    ignorePatterns: [".eslintrc.js", "dist", "node_modules", "coverage"],
    rules: {
        // TypeScript specific rules
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            },
        ],
        "@typescript-eslint/naming-convention": [
            "error",
            {
                selector: "default",
                format: ["camelCase"],
            },
            {
                selector: "variable",
                format: ["camelCase", "UPPER_CASE", "PascalCase"],
            },
            {
                selector: "parameter",
                format: ["camelCase"],
                leadingUnderscore: "allow",
            },
            {
                selector: "memberLike",
                modifiers: ["private"],
                format: ["camelCase"],
                leadingUnderscore: "require",
            },
            {
                selector: "typeLike",
                format: ["PascalCase"],
            },
            {
                selector: "interface",
                format: ["PascalCase"],
                custom: {
                    regex: "^I[A-Z]",
                    match: false,
                },
            },
        ],

        // General code style and best practices
        "prettier/prettier": "error",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "no-debugger": "error",
        "no-duplicate-imports": "error",
        "no-unused-expressions": "error",
        "no-var": "error",
        "prefer-const": "error",
        "prefer-template": "error",
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
        "object-shorthand": "error",
        "padding-line-between-statements": [
            "error",
            { blankLine: "always", prev: "*", next: "return" },
            { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
            { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
            { blankLine: "always", prev: "directive", next: "*" },
            { blankLine: "always", prev: "*", next: "function" },
        ],
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/valid-expect": "error",
    },
};
