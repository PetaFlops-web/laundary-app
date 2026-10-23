/** Deteksi pelanggaran unique constraint Prisma (kode P2002). */
export function isUniqueConstraintError(
  error: unknown,
): error is { code: string; meta?: { target?: string[] } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
