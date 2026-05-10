export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: [
    'chat-file-storage.test.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/demo/**',
    '!src/**/*.test.ts',
    '!src/**/*.integration.test.ts',
    '!src/collaboration/chat-file-storage.ts',
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
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        target: 'es2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: false,
        resolveJsonModule: true,
      },
    },
  },
};
