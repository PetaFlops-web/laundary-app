import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { isUniqueConstraintError } from '../common/utils/prisma.js';
import { normalizePhone } from '../common/utils/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    return UserResponseDto.from(user);
  }

  async updateMe(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = normalizePhone(dto.phone);
    if (dto.defaultAddress !== undefined) {
      data.defaultAddress = dto.defaultAddress;
    }

    try {
      const user = await this.prisma.user.update({ where: { id: userId }, data });

      if (!user) {
        throw new NotFoundException('Pengguna tidak ditemukan');
      }

      return UserResponseDto.from(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Nomor telepon sudah digunakan');
      }
      throw error;
    }
  }

  async findAll(
    query: QueryUsersDto,
  ): Promise<{ data: UserResponseDto[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users.map((user) => UserResponseDto.from(user)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.findById(id);
    return UserResponseDto.from(user);
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    adminId: string,
  ): Promise<UserResponseDto> {
    if (id === adminId && dto.isActive === false) {
      throw new BadRequestException(
        'Admin tidak dapat menonaktifkan dirinya sendiri',
      );
    }
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }    

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: dto.isActive },
    });
    return UserResponseDto.from(updated);
  }

  private async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    return user;
  }
}
