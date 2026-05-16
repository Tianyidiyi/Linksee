export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/../../tests'],
  testMatch: ['**/*.test.ts', '!**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/demo/**',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/**/*.integration.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1,
    },
    './src/collaboration/chat-helpers.ts': {
      branches: 80,
      functions: 50,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 15000,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: {
        ignoreCodes: [151002],
      },
    }],
  },
};
