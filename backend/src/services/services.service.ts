import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Service } from '@prisma/client';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../common/dto/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { ServiceResponseDto } from './dto/service-response.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceDto): Promise<ServiceResponseDto> {
    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
        estimatedHours: dto.estimatedHours,
        isActive: dto.isActive ?? true,
      },
    });

    return ServiceResponseDto.from(service);
  }

  async findAll(): Promise<ServiceResponseDto[]> {
    const services = await this.prisma.service.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return services.map((service) => ServiceResponseDto.from(service));
  }

  async findOne(id: string): Promise<ServiceResponseDto> {
    const service = await this.findById(id);

    if (!service) {
      throw new NotFoundException('Layanan tidak ditemukan');
    }

    return ServiceResponseDto.from(service);
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    await this.findOne(id);

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.estimatedHours !== undefined && {
          estimatedHours: dto.estimatedHours,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return ServiceResponseDto.from(service);
  }

  async remove(id: string): Promise<{ message: string }> {
    const service = await this.findById(id);

    if (!service) {
      throw new NotFoundException('Layanan tidak ditemukan');
    }

    const isUsed =
      (await this.prisma.booking.count({ where: { serviceId: id } })) > 0 ||
      (await this.prisma.orderItem.count({ where: { serviceId: id } })) > 0;

    if (isUsed) {
      if (!service.isActive) {
        throw new ConflictException('Layanan sudah dinonaktifkan');
      }

      await this.prisma.service.update({
        where: { id },
        data: { isActive: false },
      });

      return { message: 'Layanan sudah pernah dipakai dan dinonaktifkan' };
    }

    await this.prisma.service.delete({ where: { id } });

    return { message: 'Layanan berhasil dihapus' };
  }

  async findAllPublic(
    query: PaginationQueryDto,
  ): Promise<{ data: ServiceResponseDto[]; meta: PaginationMetaDto }> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const total = await this.prisma.service.count({
      where: { isActive: true },
    });

    const services = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    return {
      data: services.map((service) => ServiceResponseDto.from(service)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOnePublic(id: string): Promise<ServiceResponseDto> {
    const service = await this.prisma.service.findFirst({
      where: { id, isActive: true },
    });

    if (!service) {
      throw new NotFoundException('Layanan tidak ditemukan');
    }

    return ServiceResponseDto.from(service);
  }

  async findById(id: string): Promise<Service | null> {
    return this.prisma.service.findUnique({ where: { id } });
  }
}
