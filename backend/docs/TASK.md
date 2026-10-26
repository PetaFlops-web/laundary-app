# TASK.md — Daftar Tugas Backend Achilla Laundry

Format: `[ ]` belum dikerjakan, `[x]` selesai. Setiap baris menyebut ID kebutuhan (FR/NFR/BR/B#) bila relevan.

---

## Fase 1 — Fondasi, Auth, User, Layanan & Pengaturan

### Fondasi Teknis
- [x] Skema data `prisma/schema.prisma` sesuai SRS §6 (id UUID, uang `Decimal`, role `CUSTOMER`/`ADMIN`, enum `OrderStatus` benar, tanpa `Promotion`/`OrderItem`, model `Payment`/`Delivery`/`Conversation`/`Message` lengkap) + migrasi awal
- [x] `PrismaService` + `PrismaModule` (driver adapter `@prisma/adapter-pg`, koneksi via `DATABASE_URL`)
- [x] Seed admin awal (BR-09) — `prisma db seed` membaca `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_ADDRESS`
- [x] `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) + prefix `/api/v1`
- [x] `@nestjs/config` + validasi env saat start (NFR-04)
- [x] `helmet`, CORS whitelist, Swagger UI di `/api/docs` (NFR-04, NFR-14)
- [x] Rate limiting `@nestjs/throttler` (NFR-05)
- [x] `GET /health` (NFR-08)

### Auth (FR-01..FR-06)
- [x] `POST /auth/register` (FR-01; role selalu `CUSTOMER`, email & telepon unik, alamat wajib 10–300 karakter)
- [x] `POST /auth/login` (FR-02; tanpa membocorkan penyebab gagal)
- [x] `POST /auth/refresh` (FR-03; rotasi + deteksi pemakaian ulang)
- [x] `POST /auth/logout` (FR-04)
- [x] `POST /auth/change-password` (FR-05)
- [x] `POST /auth/forgot-password` + `POST /auth/reset-password` (FR-06, fase 4)
- [x] `JwtStrategy` (passport-jwt) agar guard yang sudah dibuat aktif

### Users (FR-07, FR-08, FR-09)
- [x] `GET /users/me` dan `PATCH /users/me` (profil sendiri; email & role tidak bisa diubah; alamat wajib tidak boleh dikosongkan)
- [x] `GET /admin/users` (filter `search`/`role`/`isActive`, paginasi), `GET /admin/users/:id`
- [x] `PATCH /admin/users/:id/status` (aktif/nonaktif; admin tidak bisa menonaktifkan diri sendiri)
- [x] `JwtAuthGuard`, `RolesGuard`, dekorator `@Roles`/`@Public`/`@CurrentUser` (FR-09)

### Services & Settings (FR-10, FR-11, FR-14, FR-15)
- [x] `GET /services`, `GET /services/:id` (publik, hanya aktif) (FR-10)
- [x] `POST/PATCH/DELETE /admin/services` (FR-11; layanan terpakai hanya dinonaktifkan)
- [x] `GET /settings/public` (FR-14)
- [x] `GET/PATCH /admin/settings` (FR-15; termasuk batas pengingat & masa berlalu bayar)
- [x] Seed layanan contoh (jelas ditandai sebagai contoh)
- [x] Seed pengaturan awal

---

## Fase 2 — Booking Pengambilan (FR-20..FR-26)

- [x] `POST /bookings` (customer): `serviceId`, estimasi, `handoverType`, `fulfillmentType`, alamat jemput/antar, catatan; status awal `PENDING` dengan kode unik (FR-20)
- [x] Validasi booking: layanan aktif, area & aktifasi antar-jemput, field wajib, normalisasi telepon/alamat, batas catatan (FR-21)
- [x] `GET /bookings/me`, `GET /bookings/me/:id` (FR-22)
- [x] `PATCH /bookings/me/:id/cancel` (hanya `PENDING`) (FR-23)
- [x] `GET /admin/bookings` (filter status/tanggal, paginasi), `GET /admin/bookings/:id` (FR-24)
- [x] `PATCH /admin/bookings/:id/status`: `CONFIRMED`/`REJECTED` (alasan wajib saat reject) (FR-25)
- [x] Batas maksimal booking `PENDING` per pelanggan (default 3) (FR-26)

---

## Fase 3 — Pesanan, Timbang, Harga & Pembayaran (FR-30..FR-38, FR-40..FR-45)

### Orders Core (FR-30..FR-35)
- [x] `POST /admin/orders`: dari booking `CONFIRMED` atau walk-in; status awal `PICKED_UP`; kode unik (FR-30)
- [x] `GET /admin/orders` (filter status/tanggal/cari, paginasi), `GET /admin/orders/:id` termasuk log, pembayaran, pengantaran (FR-31)
- [x] `PATCH /admin/orders/:id/weigh`: `weightKg > 0`, `PICKED_UP → WEIGHED`, hitung `suggestedPrice` (FR-32)
- [x] `PATCH /admin/orders/:id/price`: `totalPrice > 0`, `WEIGHED → AWAITING_PAYMENT`, `priceNote` wajib bila menyimpang, blokir bila ada payment `PENDING`/`PAID` (FR-33)
- [x] `PATCH /admin/orders/:id/status`: ke `COMPLETED`/`OUT_FOR_DELIVERY`/`DELIVERED`/`CANCELLED` sesuai alur; **tidak boleh ke `PAID`**; catat log (FR-34)
- [x] `GET /orders/me`, `GET /orders/me/:id` (customer) (FR-35)

### Payments (FR-40..FR-45)
- [x] Entitas `Payment` + relasi di Prisma + migrasi
- [x] `POST /orders/me/:id/payments`: buat transaksi gateway untuk pesanan `AWAITING_PAYMENT` milik sendiri; nominal dari server; kembalikan token/URL & `expiresAt`; gunakan ulang transaksi `PENDING` yang belum expired (FR-40)
- [x] `POST /payments/webhook`: verifikasi signature, cocokkan order & nominal, idempoten; update payment & order status (FR-41)
- [x] `GET /orders/me/:id/payment`: status pembayaran terkini + rekonsiliasi opsional (FR-42)
- [x] `GET /admin/payments` (filter, paginasi), `GET /admin/orders/:id/payments` (FR-43)
- [x] Transaksi gagal/expired memungkinkan pembuatan transaksi baru selama order `AWAITING_PAYMENT` (FR-44)
- [x] `POST /admin/orders/:id/mark-paid-cash`: khusus walk-in, catat payment `CASH` + log (FR-45)

### Reminders (FR-37, FR-38)
- [x] `GET /admin/orders/reminders`: pesanan `AWAITING_PAYMENT` melewati batas hari sejak `pricedAt` (FR-37, BR-08)
- [x] `GET /admin/orders/:id/reminder-link`: tautan `wa.me` pengingat pembayaran (FR-38)

### Hardening pasca code-review (FR-40..FR-45)
- [x] Webhook: seluruh akses DB (event + payment + order + log) dalam satu `$transaction` atomik — retry Midtrans tidak di-skip bila transaksi gagal (FR-41)
- [x] Status payment diturunkan dari `isPaymentSuccess` + fraud-aware: `capture` accept→PAID, deny→FAILED, challenge→PENDING (FR-41/FR-42)
- [x] Unit test `orders.service.spec.ts`, `payments.service.spec.ts`, `midtrans.service.spec.ts` (37 kasus baru)
- [x] Filter `dateTo` end-of-day (orders & payments list) (FR-31/FR-43)
- [x] `createPayment` re-check PENDING dalam transaksi (anti dobel transaksi Snap) (FR-40)
- [x] Timeout `fetch` Midtrans via `AbortController` (10 dtk) (FR-40/FR-42)

---

## Fase 4 — Pengantaran, Chat, Pengingat Ambil Sendiri & Dashboard

### Deliveries (FR-50..FR-52)
- [x] Entitas `Delivery` + relasi di Prisma + migrasi
- [x] `COMPLETED → OUT_FOR_DELIVERY` membuat/memperbarui `delivery` dengan alamat tujuan & `dispatchedAt` (FR-50)
- [x] `OUT_FOR_DELIVERY → DELIVERED` mengisi `deliveredAt`; tampil di detail order pelanggan (FR-51)
- [x] Validasi alamat pengantaran dalam area layanan (FR-52)

### Chat Pengguna–Admin (FR-60..FR-66)
- [x] Entitas `Conversation` & `Message` + relasi di Prisma + migrasi
- [x] Auto-buat percakapan saat pertama kali dibuka; opsional tautan ke `orderId` (FR-60)
- [x] `GET /chat/me`, `GET /chat/me/messages` (riwayat, paginasi) (FR-61)
- [x] Gateway WebSocket `/chat`: autentikasi JWT handshake, event `message:send` & `message:read`, broadcast `message:new` & `message:read`, room per percakapan (FR-62)
- [x] Fallback REST: `POST /chat/me/messages` (FR-63)
- [x] Admin: `GET /admin/chat/conversations`, `GET /admin/chat/conversations/:id/messages`, `POST /admin/chat/conversations/:id/messages` (FR-64)
- [x] Validasi pesan: teks 1–1000 karakter, sanitasi, rate limit 20 pesan/menit, tandai `readAt` (FR-65)
- [x] Otorisasi percakapan: pelanggan hanya akses miliknya (404), admin akses semua (FR-66)

### Reminders Self-Pickup & Dashboard
- [x] Pengingat cucian ambil-sendiri: pesanan `SELF_PICKUP` `COMPLETED` melewati batas hari (default 3) sejak `completedAt` (BR pengingat ambil)
- [x] Tautan `wa.me` pengingat ambil-sendiri
- [x] `GET /admin/dashboard`: ringkasan booking pending, menunggu bayar, terbayar belum selesai, sedang diantar, chat belum dibaca, pendapatan periode (FR-36)

---

## Penyesuaian Dokumen (bersamaan dengan kode)

- [ ] Perbarui `docs/SRS.md` §3 (hapus FR-12/FR-13, tambah FR-40–FR-66), §4 (endpoint matriks & WebSocket), §6 (model data)
- [ ] Perbarui `docs/PRD.md` §7 (hapus B3), §9 (alur baru), §11 (keputusan terbuka yang sudah dipilih)
- [ ] Perbarui `AGENT.md` §14 dengan keputusan tambahan bila ada

---

## Planning Kerja Langsung

Berdasarkan prioritas MoSCoW dan ketergantungan antar-modul, urutan implementasi yang akan dikerjakan selanjutnya adalah:

1. **Selesaikan Fondasi Teknis & Settings/Services** (blocking untuk semua fitur di atasnya): config/env, helmet/CORS/Swagger, rate limit, health, serta endpoint layanan & pengaturan.
2. **Booking (Fase 2)** setelah layanan & pengaturan aktif, karena booking bergantung pada validasi layanan dan area antar-jemput.
3. **Orders Core (timbang & harga)** setelah booking dapat dikonfirmasi, karena pesanan dibuat dari booking `CONFIRMED`.
4. **Payments** setelah order memiliki status `AWAITING_PAYMENT`, karena pembayaran bergantung pada `totalPrice` yang ditetapkan admin.
5. **Deliveries, Chat, Reminders, Dashboard** (Fase 4) setelah alur order dan payment stabil.

Setiap modul dikerjakan dengan pola: perbarui skema Prisma → service + DTO → controller/gateway → unit test → integrasi ke e2e → perbarui Swagger/SRS.
