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
    // The CMS writes `order: null` (not a missing key) when the field is left
    // blank. Without .nullable(), z.coerce.number() would coerce that null to
    // 0 — the lowest possible value — jumping every unordered project to the
    // very top of the sort instead of leaving it unset.
    order: z.coerce.number().nullable().optional(),
    // Optional explicit homepage cover — falls back to pages[0] when unset,
    // so an editor can pick a cover without having to reorder the pages list.
    cover: z.string().nullable().optional(),
    pages: z.array(z.string()),
  }),
});

const fjellmaraton = defineCollection({
  type: 'data',
  schema: z.object({
    // Shown above the sign-up form. Optional and nullable because the CMS
    // writes an explicit null rather than omitting the key when left empty.
    topPhotos: z.array(z.string()).nullable().optional(),
    photos: z.array(z.string()),
  }),
});

export const collections = { feed, prints, projects, fjellmaraton };
