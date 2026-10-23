import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateRandomToken, sha256 } from '../common/utils/crypto.js';
import { isUniqueConstraintError } from '../common/utils/prisma.js';
import { normalizePhone } from '../common/utils/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import {
  AuthResponseDto,
  ForgotPasswordResponseDto,
} from './dto/auth-response.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password', 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const phone = normalizePhone(dto.phone);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email,
          phone,
          passwordHash,
          role: Role.CUSTOMER,
        },
      });

      console.log('User registered:', user.id, user.email);

      return UserResponseDto.from(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const target = error.meta?.target;
        if (target?.includes('email')) {
          throw new ConflictException('Email sudah terdaftar');
        }
        if (target?.includes('phone')) {
          throw new ConflictException('Nomor telepon sudah terdaftar');
        }
        throw new ConflictException('Email atau nomor telepon sudah terdaftar');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.isActive || !passwordMatches) {
      throw new UnauthorizedException('Email atau kata sandi salah');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokenPair(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const tokenHash = sha256(dto.refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    if (token.revokedAt) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId: token.userId },
      });
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token kedaluwarsa');
    }

    if (!token.user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    const rawToken = generateRandomToken();
    const newHash = sha256(rawToken);
    const accessToken = await this.signAccessToken(token.user);

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: token.userId,
          tokenHash: newHash,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
      await tx.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date(), replacedByTokenId: created.id },
      });
    });

    return {
      accessToken,
      refreshToken: rawToken,
      user: UserResponseDto.from(token.user),
    };
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    const tokenHash = sha256(dto.refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (token && !token.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan');
    }
    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new BadRequestException('Kata sandi lama salah');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const message =
      'Jika email terdaftar, tautan reset kata sandi telah dikirim';

    if (!user) {
      return { message };
    }

    const rawToken = generateRandomToken(32);
    const tokenHash = sha256(rawToken);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    // TODO(PRD §11 no. 2): kirim rawToken lewat kanal email/WhatsApp.
    // Token disimpan ter-hash, tetapi tidak dikirim maupun dicatat di log
    // (NFR-11: log tidak memuat token). Respons selalu generik.
    return { message };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = sha256(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Token reset tidak valid atau kedaluwarsa');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);
  }

  private async issueTokenPair(user: User): Promise<AuthResponseDto> {
    const accessToken = await this.signAccessToken(user);
    const rawToken = generateRandomToken();
    const tokenHash = sha256(rawToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken,
      refreshToken: rawToken,
      user: UserResponseDto.from(user),
    };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
