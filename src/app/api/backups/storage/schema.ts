import { z } from 'zod';

// Pola ketat: accountId menjadi nama host tujuan koneksi server.
export const storageSchema = z.object({
  accountId: z.string().regex(/^[a-f0-9]{32}$/, 'Account ID harus 32 karakter hex'),
  bucket: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, 'Nama bucket tidak valid'),
  accessKeyId: z
    .string()
    .regex(/^[A-Za-z0-9]{16,128}$/, 'Access Key ID tidak valid'),
  // Kosong berarti memakai secret yang sudah tersimpan.
  secretAccessKey: z.string().max(256).optional().default(''),
});
