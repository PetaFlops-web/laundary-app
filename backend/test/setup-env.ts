import 'dotenv/config';

// Kunci JWT untuk menjalankan e2e lokal; produksi memakai JWT_ACCESS_SECRET dari env.
process.env.JWT_ACCESS_SECRET ??= 'test-secret';
