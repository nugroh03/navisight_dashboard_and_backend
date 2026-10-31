import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Enkripsi secret R2 sebelum masuk database. Kuncinya hanya ada di env, sehingga
// file backup database yang bocor tidak ikut membocorkan akses ke bucket.
export class BackupKeyMissingError extends Error {
  constructor() {
    super('BACKUP_ENCRYPTION_KEY belum diatur di server');
    this.name = 'BackupKeyMissingError';
  }
}

const getKey = () => {
  const key = process.env.BACKUP_ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(key)) throw new BackupKeyMissingError();
  return Buffer.from(key, 'hex');
};

export const isBackupKeyConfigured = () =>
  /^[0-9a-fA-F]{64}$/.test(process.env.BACKUP_ENCRYPTION_KEY ?? '');

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((part) => part.toString('base64'))
    .join('.');
}

export function decryptSecret(stored: string) {
  const [iv, tag, data] = stored
    .split('.')
    .map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8'
  );
}
