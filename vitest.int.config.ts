import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://talasey:talasey@localhost:5432/api_test',
      REDIS_URL: process.env.REDIS_URL ?? '',
    },
  },
});
