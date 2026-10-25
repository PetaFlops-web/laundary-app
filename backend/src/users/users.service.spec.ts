import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    id: 'uuid-1',
    name: 'Budi',
    email: 'budi@example.com',
    phone: '628123456789',
    passwordHash: 'hashed',
    role: Role.CUSTOMER,
    isActive: true,
    defaultAddress: 'Kost Melati No. 5',
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } satisfies User;

  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  describe('getMe', () => {
    it('mengembalikan profil tanpa passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.getMe('uuid-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('budi@example.com');
      expect(result.role).toBe(Role.CUSTOMER);
    });

    it('melempar NotFound bila user tidak ada', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('menormalkan nomor telepon ke format 62 (BR-07)', async () => {
      prisma.user.update.mockResolvedValue({ ...mockUser, phone: '628123456789' });
      await service.updateMe('uuid-1', { phone: '08123456789' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '628123456789' }),
        }),
      );
    });

    it('melempar Conflict bila telepon sudah dipakai', async () => {
      prisma.user.update.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.updateMe('uuid-1', { phone: '628123456789' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('mengembalikan data dan meta paginasi', async () => {
      prisma.$transaction.mockResolvedValue([1, [mockUser]]);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateStatus', () => {
    it('menolak admin menonaktifkan dirinya sendiri (FR-08)', async () => {
      await expect(
        service.updateStatus('uuid-1', { isActive: false }, 'uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('mengubah status aktif', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, isActive: false });
      const result = await service.updateStatus(
        'uuid-1',
        { isActive: false },
        'admin-id',
      );
      expect(result.isActive).toBe(false);
    });
  });
});
