import { Test, type TestingModule } from '@nestjs/testing';
import { BookingStatus, FulfillmentType, HandoverType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsService', () => {
  let service: BookingsService;

  const defaultSettings = {
    businessName: 'Achilla',
    pickupEnabled: true,
    deliveryEnabled: true,
    pickupArea: null,
    deliveryArea: null,
    maxPendingBookings: 3,
    paymentReminderDays: 2,
    paymentExpiryHours: 24,
  };

  const prisma = {
    service: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    booking: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const settingsService = { find: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    settingsService.find.mockResolvedValue(defaultSettings);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  const mockService = {
    id: 'svc-1',
    name: 'Cuci Reguler',
    type: 'REGULAR',
    unit: 'KG',
    price: { toString: () => '7000' },
    isActive: true,
  };

  const mockUser = {
    id: 'user-1',
    name: 'Budi',
    phone: '628123456789',
    defaultAddress: 'Kost Melati No. 5, Bandar Lampung',
    role: Role.CUSTOMER,
  };

  describe('create', () => {
    it('membuat booking PENDING dengan kode unik (FR-20)', async () => {
      prisma.service.findFirst.mockResolvedValue(mockService);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.create.mockResolvedValue({
        id: 'book-1',
        code: 'BKG-AAAA11',
        userId: 'user-1',
        serviceId: 'svc-1',
        estimatedQuantity: null,
        handoverType: HandoverType.PICKUP,
        fulfillmentType: FulfillmentType.DELIVERY,
        pickupAddress: 'Kost Melati No. 5, Bandar Lampung',
        deliveryAddress: 'Kost Melati No. 5, Bandar Lampung',
        notes: null,
        status: BookingStatus.PENDING,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        service: mockService,
        user: mockUser,
      });
      prisma.booking.findUnique = vi.fn().mockResolvedValue(null);

      const result = await service.create('user-1', {
        serviceId: 'svc-1',
        handoverType: HandoverType.PICKUP,
        fulfillmentType: FulfillmentType.DELIVERY,
      });

      expect(result.status).toBe(BookingStatus.PENDING);
      expect(result.code).toMatch(/^BKG-[A-Z0-9]{6}$/);
      expect(result.pickupAddress).toBeTruthy();
      expect(result.deliveryAddress).toBeTruthy();
    });

    it('menolak PICKUP saat penjemputan nonaktif (FR-21)', async () => {
      settingsService.find.mockResolvedValue({ ...defaultSettings, pickupEnabled: false });

      await expect(
        service.create('user-1', {
          serviceId: 'svc-1',
          handoverType: HandoverType.PICKUP,
          fulfillmentType: FulfillmentType.SELF_PICKUP,
        }),
      ).rejects.toThrow('Layanan penjemputan saat ini tidak aktif');
    });

    it('menolak DELIVERY saat pengantaran nonaktif (FR-21)', async () => {
      settingsService.find.mockResolvedValue({ ...defaultSettings, deliveryEnabled: false });

      await expect(
        service.create('user-1', {
          serviceId: 'svc-1',
          handoverType: HandoverType.DROP_OFF,
          fulfillmentType: FulfillmentType.DELIVERY,
        }),
      ).rejects.toThrow('Layanan pengantaran saat ini tidak aktif');
    });

    it('menolak bila melebihi batas booking PENDING (FR-26)', async () => {
      prisma.service.findFirst.mockResolvedValue(mockService);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.booking.count.mockResolvedValue(3);

      await expect(
        service.create('user-1', {
          serviceId: 'svc-1',
          handoverType: HandoverType.DROP_OFF,
          fulfillmentType: FulfillmentType.SELF_PICKUP,
        }),
      ).rejects.toThrow(/menunggu konfirmasi/);
    });

    it('menolak bila alamat jemput kurang dari 10 karakter', async () => {
      prisma.service.findFirst.mockResolvedValue(mockService);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, defaultAddress: null });
      prisma.booking.count.mockResolvedValue(0);

      await expect(
        service.create('user-1', {
          serviceId: 'svc-1',
          handoverType: HandoverType.PICKUP,
          fulfillmentType: FulfillmentType.SELF_PICKUP,
          pickupAddress: 'Jl. A',
        }),
      ).rejects.toThrow('Alamat jemput wajib diisi minimal 10 karakter');
    });
  });

  describe('cancelMyBooking', () => {
    it('membatalkan booking PENDING (FR-23)', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.PENDING,
      });
      prisma.booking.update.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.CANCELLED,
        service: mockService,
        user: mockUser,
      });

      const result = await service.cancelMyBooking('user-1', 'book-1');

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('menolak pembatalan bila bukan PENDING (FR-23)', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.CONFIRMED,
      });

      await expect(service.cancelMyBooking('user-1', 'book-1')).rejects.toThrow(
        'Booking hanya dapat dibatalkan saat status PENDING',
      );
    });
  });

  describe('updateStatusAdmin', () => {
    it('mengonfirmasi booking PENDING (FR-25)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.PENDING,
      });
      prisma.booking.update.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.CONFIRMED,
        service: mockService,
        user: mockUser,
      });

      const result = await service.updateStatusAdmin('book-1', { status: 'CONFIRMED' });

      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('menolak booking tanpa alasan (FR-25)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.PENDING,
      });

      await expect(
        service.updateStatusAdmin('book-1', { status: 'REJECTED' }),
      ).rejects.toThrow('Alasan penolakan wajib diisi');
    });
  });
});
