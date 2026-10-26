import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  OrderStatus,
  PaymentStatus,
  ServiceUnit,
  type Prisma,
} from '@prisma/client';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { generateOrderCode } from '../common/utils/crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { OrderResponseDto } from './dto/order-response.dto.js';
import type {
  CreateOrderDto,
  QueryOrdersDto,
  SetPriceDto,
  UpdateOrderStatusDto,
  WeighOrderDto,
} from './dto/order.dto.js';

/** Relasi standar yang di-include pada query order. */
const ORDER_INCLUDE_BRIEF = {
  service: true,
  user: true,
} as const;

const ORDER_INCLUDE_FULL = {
  service: true,
  user: true,
  statusLogs: { orderBy: { changedAt: 'desc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  delivery: true,
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  // ─── Admin: Buat pesanan ───────────────────────────────────────────

  async create(adminId: string, dto: CreateOrderDto): Promise<OrderResponseDto> {
    let customerName: string;
    let customerPhone: string;
    let serviceId: string;
    let userId: string | null = null;
    let bookingId: string | null = null;
    let deliveryAddress: string | null = dto.deliveryAddress?.trim() ?? null;

    if (dto.bookingId) {
      // Dari booking CONFIRMED
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: { user: true, service: true },
      });

      if (!booking) {
        throw new NotFoundException('Booking tidak ditemukan');
      }
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new ConflictException('Booking harus berstatus CONFIRMED untuk diproses menjadi pesanan');
      }

      // Cek apakah booking sudah punya order
      const existingOrder = await this.prisma.order.findUnique({
        where: { bookingId: booking.id },
      });
      if (existingOrder) {
        throw new ConflictException('Booking ini sudah memiliki pesanan');
      }

      customerName = booking.user.name;
      customerPhone = booking.user.phone;
      serviceId = booking.serviceId;
      userId = booking.userId;
      bookingId = booking.id;
      deliveryAddress = deliveryAddress || booking.deliveryAddress || booking.user.defaultAddress;
    } else {
      // Walk-in
      if (!dto.customerName?.trim() || !dto.customerPhone?.trim()) {
        throw new BadRequestException('Nama dan telepon pelanggan wajib diisi untuk pesanan walk-in');
      }
      if (!dto.serviceId) {
        throw new BadRequestException('ID layanan wajib diisi untuk pesanan walk-in');
      }

      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, isActive: true },
      });
      if (!service) {
        throw new BadRequestException('Layanan tidak ditemukan atau tidak aktif');
      }

      customerName = dto.customerName.trim();
      customerPhone = dto.customerPhone.trim();
      serviceId = dto.serviceId;
    }

    const code = await this.generateUniqueCode();

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          code,
          bookingId,
          userId,
          serviceId,
          customerName,
          customerPhone,
          deliveryAddress,
          status: OrderStatus.PICKED_UP,
          notes: dto.notes?.trim() || null,
        },
        include: ORDER_INCLUDE_BRIEF,
      });

      // Catat log status awal
      await tx.orderStatusLog.create({
        data: {
          orderId: created.id,
          status: OrderStatus.PICKED_UP,
          actor: 'ADMIN',
          changedByUserId: adminId,
          note: bookingId ? 'Pesanan dibuat dari booking' : 'Pesanan walk-in',
        },
      });

      return created;
    });

    return OrderResponseDto.from(order);
  }

  // ─── Admin: Daftar semua pesanan ──────────────────────────────────

  async findAllAdmin(
    query: QueryOrdersDto,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status as OrderStatus;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { customerName: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s } },
      ];
    }

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: ORDER_INCLUDE_BRIEF,
      }),
    ]);

    return {
      data: orders.map((o) => OrderResponseDto.from(o)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Admin: Detail pesanan ────────────────────────────────────────

  async findOneAdmin(id: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE_FULL,
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    return OrderResponseDto.from(order);
  }

  // ─── Admin: Catat berat (FR-32) ──────────────────────────────────

  async weigh(adminId: string, id: string, dto: WeighOrderDto): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { service: true },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    if (order.status !== OrderStatus.PICKED_UP) {
      throw new ConflictException('Pesanan harus berstatus PICKED_UP untuk ditimbang');
    }

    const weightNum = parseFloat(dto.weightKg);
    if (!Number.isFinite(weightNum) || weightNum <= 0) {
      throw new BadRequestException('Berat harus lebih dari 0');
    }

    // Hitung saran harga jika satuan KG
    let suggestedPrice: number | null = null;
    if (order.service.unit === ServiceUnit.KG) {
      suggestedPrice = Math.round(weightNum * Number(order.service.price) * 100) / 100;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: {
          weightKg: weightNum,
          suggestedPrice,
          status: OrderStatus.WEIGHED,
          weighedAt: new Date(),
        },
        include: ORDER_INCLUDE_FULL,
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          status: OrderStatus.WEIGHED,
          actor: 'ADMIN',
          changedByUserId: adminId,
          note: `Berat: ${weightNum} kg` + (suggestedPrice ? `, saran harga: Rp${suggestedPrice}` : ''),
        },
      });

      return o;
    });

    return OrderResponseDto.from(updated);
  }

  // ─── Admin: Tetapkan harga (FR-33) ────────────────────────────────

  async setPrice(adminId: string, id: string, dto: SetPriceDto): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    if (order.status !== OrderStatus.WEIGHED) {
      throw new ConflictException('Pesanan harus berstatus WEIGHED untuk menetapkan harga');
    }

    const priceNum = parseFloat(dto.totalPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new BadRequestException('Harga harus lebih dari 0');
    }

    // Blokir jika ada payment PENDING atau PAID
    const blockingPayment = order.payments.find(
      (p) => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PAID,
    );
    if (blockingPayment) {
      throw new ConflictException('Harga tidak dapat diubah karena sudah ada pembayaran aktif');
    }

    // priceNote wajib jika berbeda dari suggestedPrice
    if (order.suggestedPrice && priceNum !== Number(order.suggestedPrice)) {
      if (!dto.priceNote?.trim()) {
        throw new BadRequestException('Catatan harga wajib diisi jika harga berbeda dari saran');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: {
          totalPrice: priceNum,
          priceNote: dto.priceNote?.trim() || null,
          status: OrderStatus.AWAITING_PAYMENT,
          pricedAt: new Date(),
        },
        include: ORDER_INCLUDE_FULL,
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          status: OrderStatus.AWAITING_PAYMENT,
          actor: 'ADMIN',
          changedByUserId: adminId,
          note: `Harga ditetapkan: Rp${priceNum}` + (dto.priceNote ? ` — ${dto.priceNote.trim()}` : ''),
        },
      });

      return o;
    });

    return OrderResponseDto.from(updated);
  }

  // ─── Admin: Ubah status (FR-34) ───────────────────────────────────

  async updateStatus(
    adminId: string,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payments: true, delivery: true },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    const target = dto.status as OrderStatus;

    // PAID tidak boleh diset lewat endpoint ini
    if (target === OrderStatus.PAID) {
      throw new ConflictException('Status PAID hanya dapat ditetapkan oleh sistem pembayaran');
    }

    // Validasi transisi
    this.validateStatusTransition(order.status, target);

    // CANCELLED: blokir jika ada payment PAID
    if (target === OrderStatus.CANCELLED) {
      const hasPaidPayment = order.payments.some((p) => p.status === PaymentStatus.PAID);
      if (hasPaidPayment) {
        throw new ConflictException('Pesanan tidak dapat dibatalkan karena sudah ada pembayaran terbayar');
      }
    }

    // OUT_FOR_DELIVERY: validasi alamat & buat/update delivery (FR-50, FR-52)
    if (target === OrderStatus.OUT_FOR_DELIVERY) {
      const address = dto.deliveryAddress?.trim() || order.deliveryAddress;
      if (!address) {
        throw new BadRequestException('Alamat pengantaran wajib ada untuk pengiriman');
      }

      // Validasi area layanan jika deliveryArea diset (FR-52)
      const settings = await this.settingsService.find();
      if (!settings.deliveryEnabled) {
        throw new ConflictException('Fitur pengantaran sedang tidak aktif');
      }
      if (settings.deliveryArea) {
        const areas = settings.deliveryArea
          .split(',')
          .map((a) => a.trim().toLowerCase());
        const matchesArea = areas.some((a) => address.toLowerCase().includes(a));
        if (!matchesArea) {
          throw new BadRequestException(
            `Alamat pengantaran di luar area layanan (${settings.deliveryArea})`,
          );
        }
      }

      // Simpan override alamat di order jika diberikan
      if (dto.deliveryAddress?.trim()) {
        await this.prisma.order.update({
          where: { id },
          data: { deliveryAddress: dto.deliveryAddress.trim() },
        });
      }
    }

    // Siapkan data update
    const now = new Date();
    const updateData: Prisma.OrderUpdateInput = { status: target };
    if (target === OrderStatus.COMPLETED) {
      updateData.completedAt = now;
    }
    if (target === OrderStatus.DELIVERED) {
      updateData.deliveredAt = now;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: updateData,
        include: ORDER_INCLUDE_FULL,
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          status: target,
          actor: 'ADMIN',
          changedByUserId: adminId,
          note: dto.note?.trim() || null,
        },
      });

      // OUT_FOR_DELIVERY: buat/update record Delivery (FR-50)
      if (target === OrderStatus.OUT_FOR_DELIVERY) {
        const deliveryAddress =
          dto.deliveryAddress?.trim() || order.deliveryAddress!;
        if (order.delivery) {
          await tx.delivery.update({
            where: { id: order.delivery.id },
            data: {
              address: deliveryAddress,
              courierName: dto.courierName?.trim() || order.delivery.courierName,
              dispatchedAt: now,
            },
          });
        } else {
          await tx.delivery.create({
            data: {
              orderId: id,
              address: deliveryAddress,
              courierName: dto.courierName?.trim() || null,
              dispatchedAt: now,
            },
          });
        }
      }

      // DELIVERED: update delivery.deliveredAt (FR-51)
      if (target === OrderStatus.DELIVERED && o.delivery) {
        await tx.delivery.update({
          where: { id: o.delivery.id },
          data: { deliveredAt: now },
        });
      }

      return o;
    });

    // Re-fetch agar delivery data ter-update di response
    if (target === OrderStatus.OUT_FOR_DELIVERY || target === OrderStatus.DELIVERED) {
      return this.findOneAdmin(id);
    }

    return OrderResponseDto.from(updated);
  }

  // ─── Customer: Pesanan saya ───────────────────────────────────────

  async findMyOrders(
    userId: string,
    query: QueryOrdersDto,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { userId };

    if (query.status) {
      where.status = query.status as OrderStatus;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: ORDER_INCLUDE_BRIEF,
      }),
    ]);

    return {
      data: orders.map((o) => OrderResponseDto.from(o)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMyOrderById(userId: string, id: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: ORDER_INCLUDE_FULL,
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    return OrderResponseDto.from(order);
  }

  // ─── Reminders (FR-37, FR-38) ─────────────────────────────────────

  async getReminders(): Promise<OrderResponseDto[]> {
    const settings = await this.settingsService.find();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.paymentReminderDays);

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.AWAITING_PAYMENT,
        pricedAt: { lte: cutoff },
      },
      orderBy: { pricedAt: 'asc' },
      include: ORDER_INCLUDE_BRIEF,
    });

    return orders.map((o) => OrderResponseDto.from(o));
  }

  async getReminderLink(id: string): Promise<{ link: string }> {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new ConflictException('Pengingat hanya untuk pesanan berstatus AWAITING_PAYMENT');
    }

    const settings = await this.settingsService.find();

    const message = encodeURIComponent(
      `Halo ${order.customerName}, pesanan Anda (${order.code}) sebesar Rp${order.totalPrice?.toString() ?? '0'} belum dibayar. Silakan segera lakukan pembayaran. Terima kasih — ${settings.businessName}`,
    );
    const phone = order.customerPhone.replace(/^0/, '62');
    const link = `https://wa.me/${phone}?text=${message}`;

    return { link };
  }

  // ─── Self-Pickup Reminders ─────────────────────────────────────────

  async getSelfPickupReminders(): Promise<OrderResponseDto[]> {
    const settings = await this.settingsService.find();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.selfPickupReminderDays);

    // Pesanan COMPLETED yang belum diantar (tetap di COMPLETED) dan
    // completedAt sudah melewati batas hari — artinya belum diambil pelanggan.
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.COMPLETED,
        completedAt: { lte: cutoff },
      },
      orderBy: { completedAt: 'asc' },
      include: ORDER_INCLUDE_BRIEF,
    });

    return orders.map((o) => OrderResponseDto.from(o));
  }

  async getSelfPickupReminderLink(id: string): Promise<{ link: string }> {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new ConflictException('Pengingat ambil hanya untuk pesanan berstatus COMPLETED');
    }

    const settings = await this.settingsService.find();

    const message = encodeURIComponent(
      `Halo ${order.customerName}, cucian Anda (${order.code}) sudah selesai dan siap diambil. Silakan segera mengambil di ${settings.businessAddress}. Terima kasih — ${settings.businessName}`,
    );
    const phone = order.customerPhone.replace(/^0/, '62');
    const link = `https://wa.me/${phone}?text=${message}`;

    return { link };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  /**
   * Validasi transisi status sesuai SRS §3.8.
   * Hanya maju satu tahap; tidak boleh melompat atau mundur.
   */
  private validateStatusTransition(current: OrderStatus, target: OrderStatus): void {
    const allowed: Record<string, string[]> = {
      [OrderStatus.PICKED_UP]: [OrderStatus.WEIGHED, OrderStatus.CANCELLED],
      [OrderStatus.WEIGHED]: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
      [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
    };

    const valid = allowed[current];
    if (!valid || !valid.includes(target)) {
      throw new ConflictException(
        `Transisi status tidak valid: ${current} → ${target}`,
      );
    }
  }

  private async generateUniqueCode(): Promise<string> {
    let attempts = 0;
    while (attempts < 10) {
      const code = generateOrderCode();
      const existing = await this.prisma.order.findUnique({ where: { code } });
      if (!existing) return code;
      attempts++;
    }
    throw new ConflictException('Gagal membuat kode pesanan unik');
  }
}
