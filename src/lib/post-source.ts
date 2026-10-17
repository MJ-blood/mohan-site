import { globSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'astro/zod';

const text = z.string().trim().min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}, '日期不存在');
export const metadataSchema = z.object({
  title: text.optional(), summary: text.optional(), tags: z.array(text).default([]),
  date: date.optional(), updated: date.optional(), draft: z.boolean().default(false),
  slug: text.regex(/^[\p{L}\p{N}_-]+$/u).optional(),
}).strict().refine(data => !data.date || !data.updated || data.updated >= data.date, {
  message: 'updated 不能早于 date',
});

export const postSchema = z.object({
  title: text, summary: text, tags: z.array(text), date: z.string(), updated: z.string(),
  slug: text, minutes: z.number(), search: z.string(),
  headings: z.array(z.object({ depth: z.number(), slug: z.string(), text: z.string() })),
  attachments: z.array(z.object({ source: z.string(), route: z.string() })),
});
export type PostData = z.infer<typeof postSchema>;

export function isInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function readPost(file: string) {
  try {
    let body = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    let raw: unknown = {};
    if (body.startsWith('---\n')) {
      const end = body.indexOf('\n---', 4);
      if (end === -1 || (body[end + 4] && body[end + 4] !== '\n')) throw new Error('YAML 信息缺少结束分隔行');
      const document = parseDocument(body.slice(4, end));
      if (document.errors.length) throw new Error(document.errors.map(error => error.message).join('\n'));
      raw = document.toJS({ maxAliasCount: 100 }) ?? {};
      body = body.slice(end + 4).trimStart();
    }
    const metadata = metadataSchema.parse(raw);
    const slug = metadata.slug ?? path.basename(file, '.md');
    if (!/^[\p{L}\p{N}_-]+$/u.test(slug)) throw new Error('文件名或 slug 只能包含文字、数字、下划线和连字符');
    return { file, body, metadata, slug };
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readPosts(root: string) {
  const directory = realpathSync(path.join(root, 'content/posts'));
  const slugs = new Set<string>();
  return [...globSync('**/*.md', { cwd: directory })].sort().map(entry => {
    const file = realpathSync(path.join(directory, entry));
    if (!isInside(directory, file)) throw new Error(`文章链接越出 content/posts：${entry}`);
    const post = readPost(file);
    if (slugs.has(post.slug)) throw new Error(`文章地址重复：${post.slug}`);
    slugs.add(post.slug);
    return post;
  });
}

export const postRoute = (slug: string) => `/writing/${encodeURIComponent(slug)}/`;
export const sortDate = (post: Pick<PostData, 'updated' | 'date'>) => post.updated || post.date;
