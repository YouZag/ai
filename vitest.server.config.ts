import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@schemas': resolve(root, 'schemas/index.ts'),
      '@shared/errors': resolve(root, 'shared/errors.ts'),
      '@shared/tasks': resolve(root, 'shared/tasks.ts'),
      '@shared': resolve(root, 'shared/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'test/**/*.test.ts'],
    fileParallelism: false,
  },
});
