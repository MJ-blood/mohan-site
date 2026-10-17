import path from 'node:path';
import { realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Text } from 'mdast';
import type { Element } from 'hast';
import type { RemarkPlugin, RehypePlugin } from '@astrojs/markdown-remark';
import { unified } from '@astrojs/markdown-remark';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import { isInside, postRoute, readPost, type PostData } from './post-source';

const attachmentTypes = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg', '.pdf']);

/** Preserve the site's authoring contract while Astro handles Markdown rendering. */
export const remarkPosts: RemarkPlugin<[{ root: string }]> = ({ root }) => (tree, file) => {
  const filename = file.path.startsWith('file:') ? fileURLToPath(file.path) : file.path;
  const post = readPost(filename);
  const contentRoot = realpathSync(path.join(root, 'content'));
  const postsRoot = realpathSync(path.join(root, 'content/posts'));
  const first = tree.children[0];
  const title = post.metadata.title ?? (first?.type === 'heading' && first.depth === 1 ? toString(first) : path.basename(filename, '.md'));
  if (first?.type === 'heading' && first.depth === 1) tree.children.shift();
  if (!tree.children.length) throw new Error(`${filename}: 文章正文不能为空`);

  const ids = new Set(['top', 'main', 'primary-navigation', 'article-start', 'article-toc']);
  const headings: PostData['headings'] = [];
  const attachments = new Map<string, PostData['attachments'][number]>();
  visit(tree, 'heading', node => {
    if (node.depth === 1) throw new Error(`${filename}: 正文标题请从 ## 开始`);
    const last = node.children.at(-1);
    const explicit = last?.type === 'text' ? last.value.match(/\s+\{#([\p{L}\p{N}_-]+)\}\s*$/u) : null;
    if (explicit && last?.type === 'text') last.value = last.value.slice(0, explicit.index);
    const label = toString(node);
    const base = explicit?.[1] ?? (label.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'section');
    let id = base;
    if (explicit && ids.has(id)) throw new Error(`${filename}: 目录锚点重复：${id}`);
    for (let suffix = 2; ids.has(id); suffix++) id = `${base}-${suffix}`;
    ids.add(id);
    node.data = { ...node.data, hProperties: { id } };
    if (node.depth === 2 || node.depth === 3) headings.push({ depth: node.depth, slug: id, text: label });
  });

  const references = new Set<string>();
  visit(tree, node => {
    if (node.type === 'linkReference' || node.type === 'imageReference') references.add(node.identifier);
  });
  visit(tree, node => {
    if (node.type !== 'link' && node.type !== 'image' && node.type !== 'definition') return;
    if (node.type === 'definition' && !references.has(node.identifier)) return;
    const url = node.url;
    // Reject executable URLs; external HTTP/mail links and local anchors remain readable.
    if (/^[\u0000-\u0020]*(?:javascript|vbscript|data):/i.test(url)) {
      node.url = '#';
      return;
    }
    if (!url || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) return;
    const match = url.match(/^([^?#]*)(.*)$/)!;
    if (!match[1]) return;
    const target = realpathSync(path.resolve(path.dirname(filename), decodeURIComponent(match[1])));
    if (!isInside(contentRoot, target) || !statSync(target).isFile()) throw new Error(`${filename}: 引用越出公开内容目录：${url}`);
    let route: string;
    if (path.extname(target).toLowerCase() === '.md') {
      if (!isInside(postsRoot, target)) throw new Error(`${filename}: 引用了文章目录外的 Markdown：${url}`);
      const linked = readPost(target);
      if (linked.metadata.draft) throw new Error(`${filename}: 引用了未发布的草稿：${url}`);
      route = postRoute(linked.slug);
    } else {
      if (!attachmentTypes.has(path.extname(target).toLowerCase())) throw new Error(`${filename}: 不支持的附件类型：${url}`);
      const relative = path.relative(contentRoot, target).split(path.sep).join('/');
      route = `/media/${relative.split('/').map(encodeURIComponent).join('/')}`;
      attachments.set(route, { source: path.relative(root, target).split(path.sep).join('/'), route });
    }
    node.url = route + match[2];
    if (node.type === 'image') node.data = { ...node.data, hProperties: { loading: 'lazy', decoding: 'async' } };
  });

  // Treat raw HTML as visible text, including HTML nested inside Markdown blocks.
  visit(tree, 'html', (node, index, parent) => {
    if (parent && index !== undefined) parent.children[index] = { type: 'text', value: node.value } as Text;
  });
  let summary = post.metadata.summary;
  visit(tree, 'paragraph', node => { summary ??= toString(node).trim().slice(0, 130) || undefined; });
  const paragraphs = tree.children.map(node => toString(node)).join(' ');
  const data: PostData = {
    title, summary: summary ?? title, tags: [...new Set(post.metadata.tags)],
    date: post.metadata.date ?? '', updated: post.metadata.updated ?? '', slug: post.slug,
    headings, attachments: [...attachments.values()],
    minutes: Math.max(1, Math.ceil((paragraphs.match(/[\u3400-\u9fff]|[A-Za-z0-9]+/g)?.length ?? 0) / 350)),
    search: [title, summary ?? title, ...post.metadata.tags, paragraphs].join(' '),
  };
  file.data.astro ??= { frontmatter: {} };
  file.data.astro.frontmatter ??= {};
  Object.assign(file.data.astro.frontmatter, data);
};

export const rehypeTables: RehypePlugin<[]> = () => tree => {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'table' || !parent || index === undefined) return;
    const wrapper: Element = {
      type: 'element', tagName: 'div',
      properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: '表格，可横向滚动' },
      children: [node],
    };
    parent.children[index] = wrapper;
    return index + 1;
  });
};

export function postMarkdown(root: string) {
  return {
    syntaxHighlight: false as const,
    processor: unified({
      smartypants: false,
      remarkPlugins: [[remarkPosts, { root }]],
      rehypePlugins: [rehypeTables],
    }),
  };
}
