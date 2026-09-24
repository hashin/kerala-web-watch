import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The only content collection in this project (WP4.6): `cli report` writes one Markdown file a
// month straight into `src/content/reports/`, frontmatter-first -- see `audit/src/report.ts` for
// what generates it. The `snapshot` shape here must match `ReportSnapshot` there field-for-field,
// since `readPreviousSnapshot` reads a past file's frontmatter back out the same way.
const snapshotSchema = z.object({
  sites: z.number(),
  deep_audited: z.number(),
  down: z.number(),
  hijacked: z.number(),
  broken: z.number(),
  unverifiable: z.number(),
  unaudited: z.number(),
  poor: z.number(),
  needs_work: z.number(),
  healthy: z.number(),
  median_score: z.number().nullable(),
});

const reports = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reports' }),
  schema: z.object({
    title: z.string(),
    month: z.string(),
    generated: z.string(),
    snapshot: snapshotSchema,
    deltas: snapshotSchema.nullable(),
  }),
});

export const collections = { reports };
