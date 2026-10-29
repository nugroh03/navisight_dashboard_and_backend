import { z } from 'zod';

// Live view (go2rtc + ISAPI) fields — hanya boleh diisi ADMINISTRATOR (dicek di API).
// String kosong berarti "hapus nilai" dan disimpan sebagai null.
const liveViewFields = {
  go2rtcStream: z
    .string()
    .regex(
      /^[a-z0-9_-]{1,64}$/,
      'Hanya huruf kecil, angka, "_" atau "-" (maks. 64 karakter)'
    )
    .or(z.literal(''))
    .optional(),
  isapiHost: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$|^(?![\d.]+$)(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
      'Masukkan IP atau hostname kamera yang valid'
    )
    .or(z.literal(''))
    .optional(),
  ptzEnabled: z.boolean().optional(),
  audioEnabled: z.boolean().optional(),
};

// CCTV validation schemas
export const createCCTVSchema = z.object({
  name: z.string().min(1, 'Camera name is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  projectId: z.string().min(1, 'Project is required'),
  streamUrl: z.string().url('Please enter a valid URL'),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']).default('OFFLINE'),
  ...liveViewFields,
});

export const updateCCTVSchema = z.object({
  name: z.string().min(1, 'Camera name is required').optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  projectId: z.string().optional(),
  streamUrl: z.string().url('Please enter a valid URL').optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']).optional(),
  ...liveViewFields,
});

export type CreateCCTVInput = z.infer<typeof createCCTVSchema>;
export type UpdateCCTVInput = z.infer<typeof updateCCTVSchema>;
