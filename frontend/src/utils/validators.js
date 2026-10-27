// Aturan mengikuti SRS FR-01. Server tetap menjadi acuan akhir validasi.
export const ADDRESS_MIN = 10
export const ADDRESS_MAX = 300
export const PASSWORD_MIN = 8 // belum ditetapkan di SRS; sesuaikan dengan backend

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
export const isPhone = (v) => /^(\+62|62|0)8[0-9]{8,12}$/.test(v.replace(/[\s-]/g, ''))

export function validateLogin(f) {
  const e = {}
  if (!f.email.trim()) e.email = 'Email wajib diisi.'
  else if (!isEmail(f.email.trim())) e.email = 'Format email tidak valid.'
  if (!f.password) e.password = 'Kata sandi wajib diisi.'
  return e
}

export function validateRegister(f) {
  const e = {}
  if (!f.name.trim()) e.name = 'Nama lengkap wajib diisi.'
  if (!f.email.trim()) e.email = 'Email wajib diisi.'
  else if (!isEmail(f.email.trim())) e.email = 'Format email tidak valid.'
  if (!f.phone.trim()) e.phone = 'Nomor telepon wajib diisi.'
  else if (!isPhone(f.phone.trim())) e.phone = 'Gunakan nomor Indonesia, contoh 081234567890.'
  const addr = f.address.trim()
  if (!addr) e.address = 'Alamat wajib diisi.'
  else if (addr.length < ADDRESS_MIN) e.address = `Alamat minimal ${ADDRESS_MIN} karakter.`
  else if (addr.length > ADDRESS_MAX) e.address = `Alamat maksimal ${ADDRESS_MAX} karakter.`
  if (!f.password) e.password = 'Kata sandi wajib diisi.'
  else if (f.password.length < PASSWORD_MIN) e.password = `Kata sandi minimal ${PASSWORD_MIN} karakter.`
  return e
}

// Ubah error server { errors: [{ field, message }] } menjadi { field: message }
export function mapServerErrors(data) {
  const out = {}
  for (const item of data?.errors ?? []) out[item.field] = item.message
  return out
}
