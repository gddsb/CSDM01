import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**/*.ts', 'src/utils/**/*.ts', 'src/middleware/**/*.ts'],
      exclude: ['**/*.d.ts', '**/node_modules/**'],
    },
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
