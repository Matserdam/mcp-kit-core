import z from 'zod';

export const canonicalSearchInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(100).optional(),
  site: z.string().optional(),
  timeRange: z.enum(['day', 'week', 'month', 'year']).optional(),
});

export const canonicalFetchInputSchema = z.object({
  id: z.string().min(1),
  uri: z.string().url().optional(),
});


