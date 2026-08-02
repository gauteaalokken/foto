import { defineCollection, z } from 'astro:content';

const photoListSchema = z.object({
  photos: z.array(z.string()),
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

const projects = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    year: z.string(),
    order: z.coerce.number().optional(),
    pages: z.array(z.string()),
  }),
});

const fjellmaraton = defineCollection({
  type: 'data',
  schema: photoListSchema,
});

export const collections = { feed, prints, projects, fjellmaraton };
