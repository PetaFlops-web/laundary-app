/** Ambil variabel environment wajib; gagal cepat bila belum diatur. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabel environment ${name} belum diatur`);
  }
  return value;
}
