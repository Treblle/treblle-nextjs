/**
 * @file tests/setup.ts
 * @description Jest setup file for Treblle SDK tests
 */

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset environment variables
  delete process.env.TREBLLE_SDK_TOKEN;
  delete process.env.TREBLLE_API_KEY;
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase default timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment the line below to silence console.log during tests
  // log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock timers for consistent testing
// jest.useFakeTimers();

export {};
