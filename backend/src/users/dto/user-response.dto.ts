import type { Role, User } from '@prisma/client';

export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string;
  role!: Role;
  isActive!: boolean;
  defaultAddress!: string;
  lastLoginAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      defaultAddress: user.defaultAddress,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
