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

// A classic full-portfolio page (like the old homepage), kept for showing to
// a potential client. Always exists at /portefolje; showInNav just controls
// whether it's linked from the site navigation — see Header.astro.
const portfolio = defineCollection({
  type: 'data',
  schema: z.object({
    showInNav: z.boolean().nullable().optional(),
    photos: z.array(z.string()),
  }),
});

// Each blog post is a list of content blocks so an editor can freely mix
// text with different image layouts — including image-only posts — instead
// of a single flat body. `type` is the discriminator the CMS's variable-type
// list widget writes by default (its `typeKey`, unset here since 'type' is
// already the default).
// Grid/masonry/feed/carousel used to be four separate block types, which
// meant switching styles required deleting the block and re-adding every
// photo. They're now one "image_gallery" type with a `layout` selector, so
// changing the layout is just changing a dropdown.
const galleryLayoutSchema = z.enum(['grid', 'masonry', 'feed', 'carousel']);

const blogBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('image'), image: z.string(), caption: z.string().nullable().optional() }),
  z.object({ type: z.literal('image_pair'), images: z.array(z.string()) }),
  z.object({ type: z.literal('image_gallery'), layout: galleryLayoutSchema, images: z.array(z.string()) }),
]);

const blog = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    // The CMS's datetime widget writes an unquoted date (e.g. `2026-08-07`),
    // which YAML parses as a native Date, not a string — z.coerce.date()
    // accepts either that or a plain string.
    date: z.coerce.date(),
    // When set, the post opens straight into the fullscreen lightbox
    // (starting at the first photo) instead of the normal block layout.
    openInLightbox: z.boolean().nullable().optional(),
    blocks: z.array(blogBlockSchema),
  }),
});

// Settings for the /blogg listing page itself (title/intro shown at the top,
// and whether it's linked from the nav) — separate from individual posts, so
// an editor can customize the front page without touching post content.
const blogSettings = defineCollection({
  type: 'data',
  schema: z.object({
    showInNav: z.boolean().nullable().optional(),
    title: z.string().nullable().optional(),
    intro: z.string().nullable().optional(),
  }),
});

export const collections = { feed, prints, projects, fjellmaraton, portfolio, blog, blogSettings };
