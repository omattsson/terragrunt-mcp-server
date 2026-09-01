import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 20000, // 20 seconds - unit tests should be fast
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
    },
    // Faster test execution for unit tests: run each file in its own fork,
    // in parallel. Parallel file execution is the Vitest 4 default, so the old
    // poolOptions.forks.singleFork: false (removed in v4) needs no replacement.
    pool: 'forks',
  },
});
