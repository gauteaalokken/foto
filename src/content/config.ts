import { defineCollection, z } from 'astro:content';

const photoListSchema = z.object({
  photos: z.array(z.string()),
});

const gallery = defineCollection({
  type: 'data',
  schema: photoListSchema,
});

const feed = defineCollection({
  type: 'data',
  schema: photoListSchema,
});

const prints = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    photo: z.string(),
  }),
});

export const collections = { gallery, feed, prints };
