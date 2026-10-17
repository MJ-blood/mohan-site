import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { postsLoader } from './loaders/posts';
import { postSchema } from './lib/post-source';

export const collections = {
  posts: defineCollection({
    loader: postsLoader(),
    schema: z.union([postSchema, z.object({ error: z.string() })]),
  }),
};
