import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getPosts } from '../../lib/content';

export const getStaticPaths = (async () => {
  const attachments = new Map((await getPosts()).flatMap(post => post.data.attachments).map(asset => [asset.route, asset]));
  return [...attachments.values()].map(asset => ({
    params: { path: decodeURIComponent(asset.route.slice('/media/'.length)) }, props: { source: asset.source },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const file = path.resolve(props.source);
  const bytes = await readFile(file);
  const types: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': types[path.extname(file).toLowerCase()] ?? 'application/octet-stream' } });
};
