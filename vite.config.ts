import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
// maxcot is vendored as source (see vendor/VENDORED.md), the way its own studio
// uses it: the entry points are aliased, so nothing needs a build step first.
const lib = (p: string) => resolve(here, 'vendor/maxcot/src', p);

export default defineConfig({
  base: './',
  resolve: {
    alias: [
      { find: /^maxcot$/, replacement: lib('index.ts') },
      { find: /^maxcot\/(skins|film|score)$/, replacement: lib('$1/index.ts') }
    ]
  },
  server: { port: 5210, strictPort: false }
});
