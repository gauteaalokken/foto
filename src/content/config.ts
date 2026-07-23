import { defineCollection, z } from 'astro:content';

const gallery = defineCollection({
  type: 'data',
  schema: z.object({
    photos: z.array(z.string()),
  }),
});

export const collections = { gallery };
