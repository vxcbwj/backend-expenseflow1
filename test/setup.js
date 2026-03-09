/**
 * Test setup file - runs before all tests
 */

// Set test environment
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://localhost:27017/expenseflow-test";
process.env.JWT_SECRET = "test-secret-key-for-testing-only";

// Suppress console logs during tests unless debugging
if (process.env.DEBUG !== "true") {
  global.console.log = jest.fn();
  global.console.warn = jest.fn();
  global.console.error = jest.fn();
}

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
