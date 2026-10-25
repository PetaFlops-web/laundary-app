import { createHash, randomBytes } from 'node:crypto';

/** Hash SHA-256 heksadesimal (untuk refresh token & reset token). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Token acak (hex) untuk refresh/reset token. */
export function generateRandomToken(bytes = 48): string {
  return randomBytes(bytes).toString('hex');
}

/** Kode booking unik yang mudah dibaca, contoh: BKG-A3F9K2. */
export function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BKG-${suffix}`;
}

/** Kode pesanan unik yang mudah dibaca, contoh: ORD-A3F9K2. */
export function generateOrderCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ORD-${suffix}`;
}
