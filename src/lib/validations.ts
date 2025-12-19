import { z } from 'zod';

// CCTV validation schemas
export const createCCTVSchema = z.object({
  name: z.string().min(1, 'Camera name is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  projectId: z.string().min(1, 'Project is required'),
  streamUrl: z.string().url('Please enter a valid URL'),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']).default('OFFLINE'),
});

export const updateCCTVSchema = z.object({
  name: z.string().min(1, 'Camera name is required').optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  projectId: z.string().optional(),
  streamUrl: z.string().url('Please enter a valid URL').optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']).optional(),
});

export type CreateCCTVInput = z.infer<typeof createCCTVSchema>;
export type UpdateCCTVInput = z.infer<typeof updateCCTVSchema>;
