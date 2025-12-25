import { defineCollection, z } from 'astro:content';

const galleryCollection = defineCollection({
  type: 'content', // v2.5.0+ feature, but 'data' or 'content' works. Using content to include markdown body if needed.
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().optional(),
    image: image(),
    originalUrl: z.string().url(),
    author: z.string(),
    date: z.date(),
  }),
});

export const collections = {
  'gallery': galleryCollection,
};
