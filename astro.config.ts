import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { postMarkdown } from './src/lib/markdown';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: postMarkdown(fileURLToPath(new URL('.', import.meta.url))),
});
