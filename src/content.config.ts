import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const peopleSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(["AI Lab participant", "Mentor"]),
  team: z.string().optional(),
  publicTeam: z.string().optional(),
  mentorType: z.string().optional(),
  cohort: z.string().optional(),
  showEmailPublicly: z.boolean().default(false),
});

const teams = defineCollection({
  loader: glob({ base: "./src/content/teams", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    displayName: z.string(),
    cohort: z.string(),
    cohortLabel: z.string(),
    category: z.string(),
    status: z.string(),
    productUrl: z.url().optional(),
    tagline: z.string(),
    summary: z.string(),
    members: z.array(
      z.object({
        name: z.string(),
        email: z.email(),
        role: z.string(),
        showEmailPublicly: z.boolean().default(false),
      }),
    ),
    contactPolicy: z.string().optional(),
    visibilityNotes: z.string().optional(),
    featured: z.boolean().default(false),
    image: z.string().optional(),
    screenshots: z.array(z.string()).default([]),
  }),
});

const cohorts = defineCollection({
  loader: glob({
    base: "./src/content/cohorts",
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
    teams: z.array(z.string()).default([]),
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

export const collections = { teams, cohorts, people, mentors };
