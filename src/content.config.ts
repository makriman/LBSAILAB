import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const peopleSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email().optional(),
  role: z.string(),
  team: z.string().optional(),
  publicTeam: z.string().optional(),
  mentorType: z.string().optional(),
  focus: z.string().optional(),
  image: z.string().optional(),
  linkedinUrl: z.url().optional(),
  batch: z.string().optional(),
  showEmailPublicly: z.boolean().default(false),
});

const teams = defineCollection({
  loader: glob({ base: "./src/content/teams", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    displayName: z.string(),
    batch: z.string(),
    batchLabel: z.string(),
    category: z.string(),
    status: z.string(),
    productUrl: z.url().optional(),
    tagline: z.string(),
    summary: z.string(),
    building: z
      .object({
        userNeed: z.string(),
        productApproach: z.string(),
        nextStep: z.string(),
      })
      .optional(),
    members: z.array(
      z.object({
        name: z.string(),
        email: z.email().optional(),
        role: z.string(),
        showEmailPublicly: z.boolean().default(false),
      }),
    ),
    contactPolicy: z.string().optional(),
    visibilityNotes: z.string().optional(),
    featured: z.boolean().default(false),
    image: z.string().optional(),
    screenshots: z.array(z.string()).default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoImage: z.string().optional(),
    seoImageAlt: z.string().optional(),
    updatedAt: z.string().default("2026-06-08"),
  }),
});

const batches = defineCollection({
  loader: glob({
    base: "./src/content/batches",
    pattern: "**/*.{json,yaml,yml}",
  }),
  schema: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    season: z.string(),
    startsAt: z.string(),
    endsAt: z.string().nullable().optional(),
    status: z.enum(["current", "past", "upcoming"]),
    teamCount: z.number().nullable().optional(),
    participantCount: z.number().nullable().optional(),
    mentorCount: z.number().nullable().optional(),
    partnerName: z.string().optional(),
    partnerUrl: z.url().optional(),
    teams: z.array(z.string()).default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoImage: z.string().optional(),
    seoImageAlt: z.string().optional(),
    updatedAt: z.string().default("2026-06-08"),
  }),
});

const people = defineCollection({
  loader: file("./src/data/people.json"),
  schema: peopleSchema,
});

const mentors = defineCollection({
  loader: file("./src/data/mentors.json"),
  schema: peopleSchema,
});

export const collections = { teams, batches, people, mentors };
