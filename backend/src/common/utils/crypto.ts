import { createHash, randomBytes } from 'node:crypto';

/** Hash SHA-256 heksadesimal (untuk refresh token & reset token). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Token acak (hex) untuk refresh/reset token. */
export function generateRandomToken(bytes = 48): string {
  return randomBytes(bytes).toString('hex');
}
