import { Test, type TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  OrderStatus,
  PaymentStatus,
  ServiceUnit,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  let service: OrdersService;

  const settings = { paymentReminderDays: 2, paymentExpiryHours: 24, businessName: 'Achilla' };

  const prisma = {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    booking: { findUnique: vi.fn() },
    service: { findFirst: vi.fn() },
    orderStatusLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  const settingsService = { find: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    settingsService.find.mockResolvedValue(settings);
    prisma.order.findUnique.mockResolvedValue(null); // dipakai generateUniqueCode

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  const mockService = {
    id: 'svc-1',
    name: 'Cuci Reguler',
    type: 'REGULAR',
    unit: ServiceUnit.KG,
    price: { toString: () => '7000' },
    isActive: true,
  };

  const baseOrder = {
    id: 'order-1',
    code: 'ORD-AAAA11',
    bookingId: null,
    userId: null,
    serviceId: 'svc-1',
    customerName: 'Budi',
    customerPhone: '081234567890',
    deliveryAddress: null,
    status: OrderStatus.PICKED_UP,
    weightKg: null,
    suggestedPrice: null,
    totalPrice: null,
    priceNote: null,
    pickedUpAt: new Date(),
    weighedAt: null,
    pricedAt: null,
    paidAt: null,
    completedAt: null,
    deliveredAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create (walk-in & booking)', () => {
    it('membuat pesanan walk-in PICKED_UP (FR-30)', async () => {
      prisma.service.findFirst.mockResolvedValue(mockService);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: { create: vi.fn().mockResolvedValue({ ...baseOrder, service: mockService, user: null }) },
          orderStatusLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await service.create('admin-1', {
        customerName: 'Budi',
        customerPhone: '081234567890',
        serviceId: 'svc-1',
      });

      expect(result.status).toBe(OrderStatus.PICKED_UP);
      expect(result.code).toMatch(/^ORD-/);
    });

    it('menolak walk-in tanpa nama/telepon (FR-30)', async () => {
      await expect(
        service.create('admin-1', { serviceId: 'svc-1' } as never),
      ).rejects.toThrow('Nama dan telepon pelanggan wajib diisi');
    });

    it('membuat pesanan dari booking CONFIRMED', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        userId: 'user-1',
        serviceId: 'svc-1',
        status: BookingStatus.CONFIRMED,
        deliveryAddress: 'Jl. A',
        service: mockService,
        user: { name: 'Budi', phone: '0812', defaultAddress: 'Jl. B' },
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            create: vi.fn().mockResolvedValue({
              ...baseOrder,
              bookingId: 'book-1',
              userId: 'user-1',
              service: mockService,
              user: { name: 'Budi', phone: '0812' },
            }),
          },
          orderStatusLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await service.create('admin-1', { bookingId: 'book-1' });

      expect(result.bookingId).toBe('book-1');
      expect(result.userId).toBe('user-1');
    });

    it('menolak booking yang bukan CONFIRMED', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.PENDING,
        user: {},
        service: {},
      });

      await expect(service.create('admin-1', { bookingId: 'book-1' })).rejects.toThrow(
        'Booking harus berstatus CONFIRMED',
      );
    });
  });

  describe('weigh (FR-32)', () => {
    it('menghitung suggestedPrice dan transisi ke WEIGHED', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, service: mockService });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            update: vi.fn().mockResolvedValue({
              ...baseOrder,
              status: OrderStatus.WEIGHED,
              weightKg: { toString: () => '3.5' },
              suggestedPrice: { toString: () => '24500' },
              service: mockService,
            }),
          },
          orderStatusLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await service.weigh('admin-1', 'order-1', { weightKg: '3.5' });

      expect(result.status).toBe(OrderStatus.WEIGHED);
      expect(result.suggestedPrice).toBe('24500');
    });

    it('menolak berat <= 0', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, service: mockService });

      await expect(
        service.weigh('admin-1', 'order-1', { weightKg: '0' }),
      ).rejects.toThrow('Berat harus lebih dari 0');
    });

    it('menolak bila status bukan PICKED_UP', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.WEIGHED,
        service: mockService,
      });

      await expect(
        service.weigh('admin-1', 'order-1', { weightKg: '3.5' }),
      ).rejects.toThrow('harus berstatus PICKED_UP');
    });
  });

  describe('setPrice (FR-33)', () => {
    it('transisi ke AWAITING_PAYMENT', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.WEIGHED,
        suggestedPrice: { toString: () => '24500' },
        payments: [],
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            update: vi.fn().mockResolvedValue({
              ...baseOrder,
              status: OrderStatus.AWAITING_PAYMENT,
              totalPrice: { toString: () => '24500' },
            }),
          },
          orderStatusLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await service.setPrice('admin-1', 'order-1', { totalPrice: '24500' });

      expect(result.status).toBe(OrderStatus.AWAITING_PAYMENT);
    });

    it('menolak tanpa priceNote bila beda dari saran', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.WEIGHED,
        suggestedPrice: { toString: () => '24500' },
        payments: [],
      });

      await expect(
        service.setPrice('admin-1', 'order-1', { totalPrice: '30000' }),
      ).rejects.toThrow('Catatan harga wajib diisi');
    });

    it('menolak bila ada payment PENDING/PAID', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.WEIGHED,
        suggestedPrice: null,
        payments: [{ status: PaymentStatus.PAID }],
      });

      await expect(
        service.setPrice('admin-1', 'order-1', { totalPrice: '24500' }),
      ).rejects.toThrow('sudah ada pembayaran aktif');
    });
  });

  describe('updateStatus (FR-34)', () => {
    it('transisi valid PAID → COMPLETED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.PAID,
        payments: [],
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          order: {
            update: vi.fn().mockResolvedValue({ ...baseOrder, status: OrderStatus.COMPLETED }),
          },
          orderStatusLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await service.updateStatus('admin-1', 'order-1', { status: 'COMPLETED' });

      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('menolak status PAID dari endpoint ini', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, payments: [] });

      await expect(
        service.updateStatus('admin-1', 'order-1', { status: 'PAID' as never }),
      ).rejects.toThrow('Status PAID hanya dapat ditetapkan oleh sistem pembayaran');
    });

    it('menolak transisi melompat (PICKED_UP → DELIVERED)', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, payments: [] });

      await expect(
        service.updateStatus('admin-1', 'order-1', { status: 'DELIVERED' }),
      ).rejects.toThrow('Transisi status tidak valid');
    });

    it('menolak CANCELLED bila ada payment PAID', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.AWAITING_PAYMENT,
        payments: [{ status: PaymentStatus.PAID }],
      });

      await expect(
        service.updateStatus('admin-1', 'order-1', { status: 'CANCELLED' }),
      ).rejects.toThrow('tidak dapat dibatalkan');
    });
  });

  describe('getReminderLink (FR-38)', () => {
    it('menghasilkan tautan wa.me untuk AWAITING_PAYMENT', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.AWAITING_PAYMENT,
        totalPrice: { toString: () => '24500' },
      });

      const { link } = await service.getReminderLink('order-1');

      expect(link).toContain('https://wa.me/6281234567890');
      expect(link).toContain(encodeURIComponent('belum dibayar'));
    });

    it('menolak status selain AWAITING_PAYMENT', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, status: OrderStatus.PAID });

      await expect(service.getReminderLink('order-1')).rejects.toThrow(
        'hanya untuk pesanan berstatus AWAITING_PAYMENT',
      );
    });
  });
});
