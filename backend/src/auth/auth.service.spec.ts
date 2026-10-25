import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const PASSWORD = 'password123';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 12);

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'uuid-1',
    name: 'Budi',
    email: 'budi@example.com',
    phone: '628123456789',
    passwordHash: PASSWORD_HASH,
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
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const jwtService = { signAsync: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.$transaction.mockResolvedValue([]);
    jwtService.signAsync.mockResolvedValue('access-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('membuat customer tanpa mengembalikan passwordHash (FR-01)', async () => {
      prisma.user.create.mockResolvedValue(mockUser);
      const result = await service.register({
        name: 'Budi',
        email: 'Budi@Example.com',
        phone: '08123456789',
        address: 'Kost Melati No. 5, Bandar Lampung',
        password: PASSWORD,
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('budi@example.com');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'budi@example.com',
            phone: '628123456789',
            role: Role.CUSTOMER,
          }),
        }),
      );
    });

    it('melempar Conflict bila email sudah terdaftar (FR-01)', async () => {
      prisma.user.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      });
      await expect(
        service.register({
          name: 'Budi',
          email: 'budi@example.com',
          phone: '08123456789',
          address: 'Kost Melati No. 5, Bandar Lampung',
          password: PASSWORD,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('mengembalikan token dan profil (FR-02)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.login({
        email: 'budi@example.com',
        password: PASSWORD,
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.id).toBe('uuid-1');
    });

    it('menolak kata sandi salah', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(
        service.login({ email: 'budi@example.com', password: 'salah' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('menolak akun nonaktif dengan cara yang sama', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      await expect(
        service.login({ email: 'budi@example.com', password: PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('menolak email tidak terdaftar tanpa membocorkan penyebab', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'ghost@example.com', password: PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const tokenRecord = {
      id: 'token-1',
      userId: 'uuid-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      user: mockUser,
    };

    it('merotasi token (FR-03)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRecord);
      prisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) =>
          fn({
            refreshToken: {
              create: vi.fn().mockResolvedValue({ id: 'token-2' }),
              update: vi.fn().mockResolvedValue({}),
            },
          }),
      );
      const result = await service.refresh({ refreshToken: 'raw-token' });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeTruthy();
    });

    it('mencabut semua sesi saat token yang sudah dicabut dipakai ulang (FR-03)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...tokenRecord,
        revokedAt: new Date(),
      });
      await expect(
        service.refresh({ refreshToken: 'raw-token' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'uuid-1' },
      });
    });

    it('menolak token tidak dikenal', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(
        service.refresh({ refreshToken: 'unknown' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('menolak kata sandi lama salah (FR-05)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(
        service.changePassword('uuid-1', {
          currentPassword: 'salah',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('mengubah sandi dan mencabut semua refresh token (FR-05)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });
      await service.changePassword('uuid-1', {
        currentPassword: PASSWORD,
        newPassword: 'newpassword123',
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'uuid-1' },
      });
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('forgotPassword menyimpan token tanpa mengembalikannya (FR-06)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.forgotPassword({
        email: 'budi@example.com',
      });
      expect(result).toEqual({
        message: 'Jika email terdaftar, tautan reset kata sandi telah dikirim',
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });

    it('forgotPassword tidak membocorkan email tidak terdaftar', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword({
        email: 'ghost@example.com',
      });
      expect(result).toEqual({
        message: 'Jika email terdaftar, tautan reset kata sandi telah dikirim',
      });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('resetPassword menolak token tidak valid (FR-06)', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad', newPassword: 'newpassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resetPassword mengubah sandi dan menandai token terpakai (FR-06)', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-1',
        userId: 'uuid-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 100000),
        usedAt: null,
        createdAt: new Date(),
      });
      prisma.user.update.mockResolvedValue({});
      prisma.passwordResetToken.update.mockResolvedValue({});
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      await service.resetPassword({
        token: 'valid',
        newPassword: 'newpassword123',
      });
      expect(prisma.passwordResetToken.update).toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'uuid-1' },
      });
    });
  });
});
