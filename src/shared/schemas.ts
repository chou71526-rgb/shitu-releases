import { z } from "zod";

export const analysisResultSchema = z.object({
  primaryCategory: z.string().trim().min(1).max(40),
  terms: z.array(z.string().trim().min(1).max(40)).min(5).max(10),
});

export const imageUpdateSchema = z.object({
  favorite: z.boolean().optional(),
  note: z.string().max(10_000).optional(),
  categoryId: z.string().nullable().optional(),
  journalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  canvasX: z.number().finite().optional(),
  canvasY: z.number().finite().optional(),
  canvasWidth: z.number().min(80).max(800).optional(),
  canvasManual: z.boolean().optional(),
  journalX: z.number().finite().min(-5_000).max(5_000).optional(),
  journalY: z.number().finite().min(-5_000).max(5_000).optional(),
  journalScale: z.number().min(0.55).max(2.25).optional(),
});
