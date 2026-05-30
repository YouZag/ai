import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

const options = {
  entryPoints: [resolve(root, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: resolve(root, 'lib/index.js'),
  sourcemap: true,
  packages: 'external',
  alias: {
    '@shared': resolve(root, '../shared/index.ts'),
    '@shared/errors': resolve(root, '../shared/errors.ts'),
    '@shared/tasks': resolve(root, '../shared/tasks.ts'),
    '@schemas': resolve(root, '../schemas/index.ts'),
  },
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('esbuild: watching for changes...');
} else {
  await build(options);
}
