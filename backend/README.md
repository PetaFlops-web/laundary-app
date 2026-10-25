# Achilla Laundry — Backend API

Backend untuk Website **Achilla Laundry** (Smart Commerce). Dibangun dengan **NestJS 12** (ESM), **Prisma 7** + driver adapter `pg`, dan **PostgreSQL 17**. Pembayaran via **Midtrans Snap**.

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Framework | NestJS 12 (TypeScript, ESM `"type": "module"`) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Database | PostgreSQL 17 (Docker Compose) |
| Auth | JWT (`@nestjs/jwt` + `passport-jwt`) |
| Validasi | `class-validator` + `class-transformer` (global `ValidationPipe`) |
| Dokumentasi API | Swagger (`@nestjs/swagger`) di `/api/docs` |
| Test | Vitest |
| Lint | oxlint |
| Payment | Midtrans Snap (native `fetch`, tanpa SDK) |

## Prasyarat

- Node.js ≥ 20
- npm
- Docker + Docker Compose (untuk PostgreSQL)

## Struktur Proyek

```
backend/
├── prisma/            # schema.prisma, migrations, seed.ts
├── src/
│   ├── common/        # dekorator, guard, DTO paginasi, util
│   ├── auth/          # register, login, refresh, password
│   ├── users/         # profil + manajemen user admin
│   ├── services/      # layanan cuci
│   ├── settings/      # pengaturan bisnis
│   ├── bookings/      # booking pengambilan
│   ├── orders/        # pesanan, timbang, harga
│   ├── payments/      # Midtrans Snap, webhook, rekonsiliasi
│   ├── prisma/        # PrismaService + PrismaModule
│   ├── app.module.ts
│   └── main.ts        # bootstrap, prefix /api/v1, Swagger
├── compose.yml        # PostgreSQL
├── prisma.config.ts   # konfigurasi Prisma 7 + seed command
└── package.json
```

## Setup

### 1. Salin environment

```bash
cp .env.example .env
```

Isi nilai yang masih `CHANGE_ME`:

| Variabel | Keterangan |
|---|---|
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Kredensial PostgreSQL (dipakai juga oleh compose.yml) |
| `DB_PORT` | Port host untuk PostgreSQL (default `5433`) |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5433/dbname` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secret JWT (string acak panjang) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Masa berlaku token (mis. `15m`, `7d`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Kredensial admin awal untuk seed (BR-09) |
| `ADMIN_NAME` / `ADMIN_PHONE` | Data profil admin awal |
| `MIDTRANS_SERVER_KEY` | Server Key Midtrans (sandbox: `SB-Mid-server-...`) |
| `MIDTRANS_CLIENT_KEY` | Client Key Midtrans (sandbox: `SB-Mid-client-...`) |
| `MIDTRANS_IS_PRODUCTION` | `false` untuk sandbox, `true` untuk production |
| `CORS_ORIGINS` | Origin frontend yang diizinkan (mis. `http://localhost:5173`) |
| `REMINDER_DEFAULT_DAYS` | Batas hari pengingat pembayaran (default `3`) |

> **Catatan Midtrans:** pastikan `MIDTRANS_SERVER_KEY` berawalan `SB-Mid-server-` dan `MIDTRANS_CLIENT_KEY` berawalan `SB-Mid-client-`. Keduanya **tertukar** adalah penyebab paling umum error `401 Unauthorized` saat membuat transaksi.

### 2. Install dependensi

```bash
npm install
```

### 3. Jalankan PostgreSQL

```bash
docker compose up -d
```

### 4. Terapkan migrasi database

```bash
npx prisma migrate deploy
```

### 5. Generate Prisma client

```bash
npx prisma generate
```

### 6. Seed data awal (admin + layanan contoh + pengaturan)

```bash
npx tsx prisma/seed.ts
```

> Alternatif: `npx prisma db seed` (membaca perintah seed dari `prisma.config.ts`).

## Menjalankan Aplikasi

```bash
# development (watch mode)
npm run start:dev

# production (build dulu, lalu jalankan)
npm run build
npm run start:prod
```

Default port: `3000` (override via `PORT` di `.env`). API tersedia di bawah prefix **`/api/v1`**.

- Swagger UI: `http://localhost:3000/api/docs` (hanya saat `NODE_ENV !== 'production'`)

## Script

| Perintah | Fungsi |
|---|---|
| `npm run build` | Compile ke `dist/` |
| `npm run start` | Jalankan via Nest CLI |
| `npm run start:dev` | Watch mode |
| `npm run start:prod` | Jalankan `dist/main.js` |
| `npm run lint` | oxlint (type-aware) |
| `npm run test` | Unit test (Vitest) |
| `npm run test:watch` | Test watch mode |
| `npm run test:cov` | Test + coverage |
| `npm run test:e2e` | Test end-to-end |
| `npm run migrate:dev` | Prisma migrate dev |
| `npm run generate` | Prisma generate |

## Migrasi Prisma (untuk pengembangan)

Prisma 7 membaca konfigurasi dari `prisma.config.ts` (bukan `package.json`):

- Skema: `prisma/schema.prisma`
- Migrasi: `prisma/migrations/`
- Seed: `tsx prisma/seed.ts`

```bash
# buat migrasi baru setelah mengubah schema
npx prisma migrate dev --name <nama_migrasi>

# reset database (HANYA untuk dev — menghapus SEMUA data)
npx prisma migrate reset
```

> **Penting:** Prisma 7 memblokir `migrate reset` ketika dipanggil oleh AI agent tanpa persetujuan eksplisit pemilik. Reset hanya untuk database development — jangan pernah dijalankan ke database production.

## Alur Pembayaran Midtrans (ringkas)

1. `POST /api/v1/orders/me/:id/payments` — buat transaksi Snap, dapat `token` + `redirect_url`.
2. Customer membayar lewat `redirect_url`.
3. Midtrans mengirim webhook ke `POST /api/v1/payments/webhook` — server memverifikasi signature (`SHA512(order_id + status_code + gross_amount + ServerKey)`), mencocokkan nominal, lalu memperbarui status payment & order secara atomik (idempoten).
4. Rekonsiliasi opsional di `GET /api/v1/orders/me/:id/payment`.

**Catatan Snap v4:** transaksi yang dibuat via Snap bersifat *payment link* — belum muncul di dashboard/status API Midtrans sampai customer benar-benar membayar. Ini perilaku normal, bukan bug.

Untuk menguji webhook secara lokal, expose port server ke internet (mis. `cloudflared tunnel --url http://localhost:3000` atau `ngrok http 3000`), lalu set URL webhook `https://<tunnel>/api/v1/payments/webhook` di Dashboard Midtrans → Settings → Configuration → Payment Notification URL.

## Testing

```bash
npm run lint
npm run test
npm run build
```
