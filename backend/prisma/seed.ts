import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, ServiceType, ServiceUnit } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!connectionString) throw new Error('DATABASE_URL belum diatur');
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL dan ADMIN_PASSWORD wajib diatur untuk seed admin',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const adminPhone = process.env.ADMIN_PHONE ?? '6280000000000';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN, passwordHash },
    create: {
      name: process.env.ADMIN_NAME ?? 'Owner',
      email: adminEmail,
      phone: adminPhone,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // Layanan contoh — hanya sebagai data awal, owner harus menyesuaikan.
  const sampleServices = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Cuci Reguler',
      description: 'Layanan cuci reguler ±3 hari (contoh).',
      type: ServiceType.REGULAR,
      price: 7000,
      unit: ServiceUnit.KG,
      estimatedHours: 72,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Cuci Ekspres',
      description: 'Layanan cuci ekspres ±24 jam (contoh).',
      type: ServiceType.EXPRESS,
      price: 12000,
      unit: ServiceUnit.KG,
      estimatedHours: 24,
    },
  ];

  for (const service of sampleServices) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {},
      create: service,
    });
  }

  console.log(`Seed selesai: admin ${adminEmail}, ${sampleServices.length} layanan contoh`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
