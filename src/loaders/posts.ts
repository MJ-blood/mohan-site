import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Loader } from 'astro/loaders';
import { isInside, readPosts } from '../lib/post-source';

/** Reload the small public collection together so cross-post links stay consistent. */
export function postsLoader(): Loader {
  return {
    name: 'public-markdown-posts',
    async load({ config, store, parseData, renderMarkdown, watcher, logger }) {
      const root = fileURLToPath(config.root);
      const directory = path.join(root, 'content');
      const refresh = async () => {
        const sources = readPosts(root).filter(post => !post.metadata.draft);
        const entries = [];
        for (const post of sources) {
          const rendered = await renderMarkdown(post.body, { fileURL: pathToFileURL(post.file) });
          const data = await parseData({ id: post.slug, data: rendered.metadata?.frontmatter ?? {}, filePath: post.file });
          entries.push({ id: post.slug, data, rendered, filePath: path.relative(root, post.file) });
        }
        store.clear();
        for (const entry of entries) store.set(entry);
      };
      await refresh();
      if (watcher) {
        watcher.add(directory);
        let pending = Promise.resolve();
        watcher.on('all', (_event, file) => {
          if (!isInside(directory, path.resolve(file))) return;
          pending = pending.then(refresh).catch(error => {
            const message = error instanceof Error ? error.message : String(error);
            // Pages report the failure instead of silently presenting stale published content.
            store.clear();
            store.set({ id: '__content_error__', data: { error: message } });
            logger.error(message);
          });
        });
      }
    },
  };
}
