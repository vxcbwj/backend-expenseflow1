export default {
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/config/**",
    "!node_modules/**",
    "!**/*.test.js",
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],
  testTimeout: 10000,
};
