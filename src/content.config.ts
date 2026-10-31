import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The five pillars every post maps to (see README).
export const PILLARS = {
  serving: 'Serving & GPU efficiency',
  mlops: 'MLOps: deploy, observe, operate',
  'agent-infra': 'Agent infrastructure',
  'agentic-ai': 'Building agents that hold up',
  platform: 'Data & reliability platform',
} as const;

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    pillar: z.enum(['serving', 'mlops', 'agent-infra', 'agentic-ai', 'platform']),
    tags: z.array(z.string()).default([]),
    // Link to the repo + commit that produced the numbers in the post.
    repo: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
