/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory for tests
  roots: ['<rootDir>/__tests__/jest', '<rootDir>/packages'],

  // Test file patterns
  testMatch: [
    '<rootDir>/__tests__/jest/**/*.test.ts',
    '<rootDir>/__tests__/jest/**/*.test.tsx',
    '<rootDir>/packages/**/__tests__/**/*.test.ts',
    '<rootDir>/packages/**/__tests__/**/*.test.tsx',
  ],

  // Module path aliases
  moduleNameMapper: {
    '^@canvascast/shared$': '<rootDir>/packages/shared/src',
    '^@canvascast/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
  },

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'packages/shared/src/**/*.{ts,tsx}',
    '__tests__/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'json', 'html', 'lcov'],
  coverageDirectory: '<rootDir>/coverage',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/e2e/',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],


  // Timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,
};
