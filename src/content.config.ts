import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "src/posts",
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.date().refine((date) => !Number.isNaN(date), {
        message: "Invalid date format",
      }),
      updated: z.date().optional(),
      tags: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      draft: z.boolean().optional(),
      cover: image().optional(),
      sticky: z.boolean().optional(),
      link: z.string().optional(),
      license: z
        .enum([
          "CC-BY-4.0",
          "CC-BY-SA-4.0",
          "CC-BY-ND-4.0",
          "CC-BY-NC-4.0",
          "CC-BY-NC-SA-4.0",
          "CC-BY-NC-ND-4.0",
          "NOREPRINT",
        ])
        .optional(),
    }),
});

export const collections = {
  posts,
};
