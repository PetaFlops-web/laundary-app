import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, FulfillmentType, HandoverType, type Prisma } from '@prisma/client';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { generateBookingCode } from '../common/utils/crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { BookingResponseDto } from './dto/booking-response.dto.js';
import type { CreateBookingDto, QueryBookingsDto, UpdateBookingStatusDto } from './dto/booking.dto.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(userId: string, dto: CreateBookingDto): Promise<BookingResponseDto> {
    const settings = await this.settingsService.find();

    if (dto.handoverType === HandoverType.PICKUP && !settings.pickupEnabled) {
      throw new BadRequestException('Layanan penjemputan saat ini tidak aktif');
    }

    if (dto.fulfillmentType === FulfillmentType.DELIVERY && !settings.deliveryEnabled) {
      throw new BadRequestException('Layanan pengantaran saat ini tidak aktif');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, isActive: true },
    });

    if (!service) {
      throw new BadRequestException('Layanan tidak ditemukan atau tidak aktif');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    const pendingCount = await this.prisma.booking.count({
      where: { userId, status: BookingStatus.PENDING },
    });

    if (pendingCount >= settings.maxPendingBookings) {
      throw new ConflictException(
        `Anda memiliki ${pendingCount} booking yang menunggu konfirmasi. Tunggu konfirmasi atau batalkan sebelum membuat booking baru.`,
      );
    }

    let pickupAddress = dto.pickupAddress?.trim() ?? null;
    let deliveryAddress = dto.deliveryAddress?.trim() ?? null;

    if (dto.handoverType === HandoverType.PICKUP) {
      pickupAddress = pickupAddress || user.defaultAddress;
      if (!pickupAddress || pickupAddress.length < 10) {
        throw new BadRequestException('Alamat jemput wajib diisi minimal 10 karakter');
      }
    }

    if (dto.fulfillmentType === FulfillmentType.DELIVERY) {
      deliveryAddress = deliveryAddress || user.defaultAddress;
      if (!deliveryAddress || deliveryAddress.length < 10) {
        throw new BadRequestException('Alamat antar wajib diisi minimal 10 karakter');
      }
    }

    const code = await this.generateUniqueCode();

    const booking = await this.prisma.booking.create({
      data: {
        code,
        userId,
        serviceId: dto.serviceId,
        estimatedQuantity: dto.estimatedQuantity ? dto.estimatedQuantity : null,
        handoverType: dto.handoverType,
        fulfillmentType: dto.fulfillmentType,
        pickupAddress,
        deliveryAddress,
        notes: dto.notes?.trim() || null,
        status: BookingStatus.PENDING,
      },
      include: { service: true, user: true },
    });

    return BookingResponseDto.from(booking);
  }

  async findMyBookings(
    userId: string,
    query: QueryBookingsDto,
  ): Promise<{ data: BookingResponseDto[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { userId };

    if (query.status) {
      where.status = query.status as BookingStatus;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [total, bookings] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { service: true, user: true },
      }),
    ]);

    return {
      data: bookings.map((b) => BookingResponseDto.from(b)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMyBookingById(userId: string, id: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId },
      include: { service: true, user: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }

    return BookingResponseDto.from(booking);
  }

  async cancelMyBooking(userId: string, id: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId },
    });

    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException('Booking hanya dapat dibatalkan saat status PENDING');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
      include: { service: true, user: true },
    });

    return BookingResponseDto.from(updated);
  }

  async findAllAdmin(
    query: QueryBookingsDto,
  ): Promise<{ data: BookingResponseDto[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {};

    if (query.status) {
      where.status = query.status as BookingStatus;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [total, bookings] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { service: true, user: true },
      }),
    ]);

    return {
      data: bookings.map((b) => BookingResponseDto.from(b)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneAdmin(id: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { service: true, user: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }

    return BookingResponseDto.from(booking);
  }

  async updateStatusAdmin(
    id: string,
    dto: UpdateBookingStatusDto,
  ): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException('Booking hanya dapat dikonfirmasi/ditolak saat status PENDING');
    }

    if (dto.status === 'REJECTED' && (!dto.rejectionReason || dto.rejectionReason.trim().length === 0)) {
      throw new BadRequestException('Alasan penolakan wajib diisi');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: dto.status === 'CONFIRMED' ? BookingStatus.CONFIRMED : BookingStatus.REJECTED,
        rejectionReason: dto.rejectionReason?.trim() || null,
      },
      include: { service: true, user: true },
    });

    return BookingResponseDto.from(updated);
  }

  private async generateUniqueCode(): Promise<string> {
    let attempts = 0;
    while (attempts < 10) {
      const code = generateBookingCode();
      const existing = await this.prisma.booking.findUnique({ where: { code } });
      if (!existing) return code;
      attempts++;
    }
    throw new ConflictException('Gagal membuat kode booking unik');
  }
}
