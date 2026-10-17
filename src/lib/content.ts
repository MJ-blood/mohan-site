import { getCollection, type CollectionEntry } from 'astro:content';
import { sortDate, type PostData } from './post-source';

export type Post = Omit<CollectionEntry<'posts'>, 'data'> & { data: PostData };

export async function getPosts(): Promise<Post[]> {
  const entries = await getCollection('posts');
  const posts: Post[] = [];
  for (const entry of entries) {
    if ('error' in entry.data) throw new Error(entry.data.error);
    posts.push({ ...entry, data: entry.data });
  }
  return posts.sort((a, b) => {
    const left = `${sortDate(a.data)}\0${a.data.slug}`;
    const right = `${sortDate(b.data)}\0${b.data.slug}`;
    return left < right ? 1 : left > right ? -1 : 0;
  });
}
