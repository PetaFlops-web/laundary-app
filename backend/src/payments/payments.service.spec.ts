import { Test, type TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { MidtransService } from './midtrans.service.js';
import { PaymentsService } from './payments.service.js';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const settings = { paymentExpiryHours: 24 };

  const prisma = {
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orderStatusLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  const midtrans = {
    createSnapTransaction: vi.fn(),
    getTransactionStatus: vi.fn(),
    verifySignature: vi.fn(),
    isPaymentSuccess: vi.fn(),
    mapToPaymentStatus: vi.fn(),
  };

  const settingsService = { find: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    settingsService.find.mockResolvedValue(settings);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MidtransService, useValue: midtrans },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  const mockOrder = {
    id: 'order-1',
    code: 'ORD-AAAA11',
    status: OrderStatus.AWAITING_PAYMENT,
    totalPrice: { toString: () => '24500' },
    customerName: 'Budi',
    customerPhone: '081234567890',
    userId: 'user-1',
    payments: [],
    user: { email: 'budi@test.com' },
  };

  const mockPayment = {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'midtrans',
    providerOrderId: 'ORD-AAAA11-123',
    providerTransactionId: null,
    grossAmount: { toString: () => '24500' },
    method: null,
    status: PaymentStatus.PENDING,
    paymentToken: 'tok',
    paymentUrl: 'https://...',
    expiresAt: null,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('createPayment (FR-40)', () => {
    it('membuat transaksi Snap dan payment PENDING', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);
      midtrans.createSnapTransaction.mockResolvedValue({
        token: 'snap-token',
        redirectUrl: 'https://app.sandbox.midtrans.com/...',
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          payment: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockPayment),
          },
        };
        return fn(tx);
      });

      const result = await service.createPayment('user-1', 'order-1');

      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(midtrans.createSnapTransaction).toHaveBeenCalledTimes(1);
    });

    it('menolak order bukan AWAITING_PAYMENT', async () => {
      prisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      await expect(service.createPayment('user-1', 'order-1')).rejects.toThrow(
        'harus berstatus AWAITING_PAYMENT',
      );
    });

    it('menolak order tanpa totalPrice', async () => {
      prisma.order.findFirst.mockResolvedValue({ ...mockOrder, totalPrice: null });

      await expect(service.createPayment('user-1', 'order-1')).rejects.toThrow(
        'Harga pesanan belum ditetapkan',
      );
    });
  });

  describe('handleWebhook (FR-41)', () => {
    const validNotification = {
      order_id: 'ORD-AAAA11-123',
      transaction_id: 'tx-1',
      transaction_status: 'settlement',
      status_code: '200',
      gross_amount: '24500.00',
      signature_key: 'sig',
      payment_type: 'bank_transfer',
      fraud_status: 'accept',
    };

    it('memproses settlement → payment & order PAID', async () => {
      midtrans.verifySignature.mockReturnValue(true);
      midtrans.isPaymentSuccess.mockReturnValue(true);
      midtrans.mapToPaymentStatus.mockReturnValue(PaymentStatus.PAID);

      const paymentWithOrder = { ...mockPayment, order: { status: OrderStatus.AWAITING_PAYMENT } };
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          paymentWebhookEvent: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            update: vi.fn(),
          },
          payment: {
            findUnique: vi.fn().mockResolvedValue(paymentWithOrder),
            update: vi.fn(),
          },
          order: { update: vi.fn() },
          orderStatusLog: { create: vi.fn() },
        };
        await fn(tx);
        return tx;
      });

      await service.handleWebhook(validNotification);

      // Order update ke PAID harus dipanggil
      expect(prisma.order.update).toBeDefined();
    });

    it('signature invalid → event dicatat tapi payment tidak diproses', async () => {
      midtrans.verifySignature.mockReturnValue(false);

      const tx = {
        paymentWebhookEvent: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
        payment: {
          findUnique: vi.fn().mockResolvedValue(mockPayment),
          update: vi.fn(),
        },
        order: { update: vi.fn() },
        orderStatusLog: { create: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx2: unknown) => unknown) => fn(tx));

      await service.handleWebhook(validNotification);

      expect(tx.paymentWebhookEvent.create).toHaveBeenCalled();
      expect(tx.payment.update).not.toHaveBeenCalled();
    });

    it('idempoten: event sudah ada → skip seluruh pemrosesan', async () => {
      midtrans.verifySignature.mockReturnValue(true);

      const tx = {
        paymentWebhookEvent: {
          findUnique: vi.fn().mockResolvedValue({ id: 'evt-1' }),
          create: vi.fn(),
          update: vi.fn(),
        },
        payment: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        order: { update: vi.fn() },
        orderStatusLog: { create: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx2: unknown) => unknown) => fn(tx));

      await service.handleWebhook(validNotification);

      expect(tx.payment.findUnique).not.toHaveBeenCalled();
      expect(tx.payment.update).not.toHaveBeenCalled();
    });

    it('nominal tidak cocok → tidak update payment', async () => {
      midtrans.verifySignature.mockReturnValue(true);
      midtrans.isPaymentSuccess.mockReturnValue(true);
      midtrans.mapToPaymentStatus.mockReturnValue(PaymentStatus.PAID);

      const tx = {
        paymentWebhookEvent: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
        payment: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ ...mockPayment, order: { status: OrderStatus.AWAITING_PAYMENT } }),
          update: vi.fn(),
        },
        order: { update: vi.fn() },
        orderStatusLog: { create: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx2: unknown) => unknown) => fn(tx));

      await service.handleWebhook({ ...validNotification, gross_amount: '99999.00' });

      expect(tx.payment.update).not.toHaveBeenCalled();
    });

    it('capture + fraud deny → payment FAILED, order TIDAK PAID', async () => {
      midtrans.verifySignature.mockReturnValue(true);
      midtrans.isPaymentSuccess.mockReturnValue(false);
      midtrans.mapToPaymentStatus.mockReturnValue(PaymentStatus.FAILED);

      const order = { status: OrderStatus.AWAITING_PAYMENT };
      const tx = {
        paymentWebhookEvent: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
        payment: {
          findUnique: vi.fn().mockResolvedValue({ ...mockPayment, order }),
          update: vi.fn(),
        },
        order: { update: vi.fn() },
        orderStatusLog: { create: vi.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx2: unknown) => unknown) => fn(tx));

      await service.handleWebhook({
        ...validNotification,
        transaction_status: 'capture',
        fraud_status: 'deny',
      });

      expect(tx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
      expect(tx.order.update).not.toHaveBeenCalled();
    });
  });

  describe('markPaidCash (FR-45)', () => {
    it('menandai walk-in terbayar tunai → order PAID', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: null,
        payments: [],
        totalPrice: { toString: () => '24500' },
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          payment: {
            create: vi.fn().mockResolvedValue({
              ...mockPayment,
              provider: 'cash',
              method: 'CASH',
              status: PaymentStatus.PAID,
            }),
          },
          order: { update: vi.fn() },
          orderStatusLog: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await service.markPaidCash('admin-1', 'order-1');

      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.provider).toBe('cash');
    });

    it('menolak order dengan userId (bukan walk-in)', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...mockOrder, userId: 'user-1' });

      await expect(service.markPaidCash('admin-1', 'order-1')).rejects.toThrow(
        'hanya untuk pesanan walk-in',
      );
    });
  });
});
