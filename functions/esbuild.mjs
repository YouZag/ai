import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

await build({
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
    '@interfaces': resolve(root, '../interfaces/index.ts'),
  },
});
