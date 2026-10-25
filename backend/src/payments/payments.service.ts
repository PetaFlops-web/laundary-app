import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  type Prisma,
} from '@prisma/client';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  MidtransService,
  type MidtransNotification,
} from './midtrans.service.js';
import { PaymentResponseDto } from './dto/payment-response.dto.js';
import type { QueryPaymentsDto } from './dto/payment.dto.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly midtrans: MidtransService,
    private readonly settingsService: SettingsService,
  ) {}

  // ─── Customer: Buat pembayaran (FR-40) ─────────────────────────────

  async createPayment(
    userId: string,
    orderId: string,
  ): Promise<PaymentResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: true, user: true },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new ConflictException('Pesanan harus berstatus AWAITING_PAYMENT untuk membayar');
    }

    if (!order.totalPrice) {
      throw new BadRequestException('Harga pesanan belum ditetapkan');
    }

    // Reuse transaksi PENDING yang belum expired (FR-40)
    const pendingPayment = order.payments.find(
      (p) =>
        p.status === PaymentStatus.PENDING &&
        p.expiresAt &&
        p.expiresAt > new Date(),
    );

    if (pendingPayment) {
      return PaymentResponseDto.from(pendingPayment);
    }

    // Sudah ada pembayaran PAID
    const paidPayment = order.payments.find((p) => p.status === PaymentStatus.PAID);
    if (paidPayment) {
      throw new ConflictException('Pesanan ini sudah terbayar');
    }

    const grossAmount = Math.round(Number(order.totalPrice));
    const settings = await this.settingsService.find();
    const providerOrderId = `${order.code}-${Date.now()}`;

    const snap = await this.midtrans.createSnapTransaction({
      orderId: providerOrderId,
      grossAmount,
      customerFirstName: order.customerName,
      customerEmail: order.user?.email ?? '',
      customerPhone: order.customerPhone,
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + settings.paymentExpiryHours);

    // Buat payment dalam transaksi dengan re-check PENDING yang belum expired,
    // supaya dua request bersamaan tidak menghasilkan dua transaksi Snap.
    const payment = await this.prisma.$transaction(async (tx) => {
      const concurrentPending = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          status: PaymentStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (concurrentPending) {
        return concurrentPending;
      }

      return tx.payment.create({
        data: {
          orderId: order.id,
          provider: 'midtrans',
          providerOrderId,
          grossAmount,
          status: PaymentStatus.PENDING,
          paymentToken: snap.token,
          paymentUrl: snap.redirectUrl,
          expiresAt,
        },
      });
    });

    return PaymentResponseDto.from(payment);
  }

  // ─── Webhook handler (FR-41) ──────────────────────────────────────

  async handleWebhook(notification: MidtransNotification): Promise<void> {
    // Verifikasi signature
    const signatureValid = this.midtrans.verifySignature(
      notification.order_id,
      notification.status_code,
      notification.gross_amount,
      notification.signature_key,
    );

    const newPaymentStatus = this.midtrans.mapToPaymentStatus(
      notification.transaction_status,
      notification.fraud_status,
    );
    const isSuccess = this.midtrans.isPaymentSuccess(
      notification.transaction_status,
      notification.fraud_status,
    );

    // Semua akses DB dalam SATU transaksi interaktif — termasuk pencatatan
    // event webhook — supaya kegagalan di tengah proses me-rollback seluruh
    // perubahan (termasuk baris event), sehingga retry Midtrans tidak di-skip.
    await this.prisma.$transaction(async (tx) => {
      // Idempoten: event ini sudah pernah diproses
      const existingEvent = await tx.paymentWebhookEvent.findUnique({
        where: { providerEventId: notification.transaction_id },
      });
      if (existingEvent) {
        return;
      }

      // Cari payment berdasarkan providerOrderId
      const payment = await tx.payment.findUnique({
        where: { providerOrderId: notification.order_id },
        include: { order: true },
      });

      // Catat event terlepas dari validitas (audit trail)
      await tx.paymentWebhookEvent.create({
        data: {
          paymentId: payment?.id ?? null,
          providerEventId: notification.transaction_id,
          status: notification.transaction_status,
          signatureValid,
        },
      });

      if (!signatureValid) {
        this.logger.warn(`Webhook signature tidak valid untuk order ${notification.order_id}`);
        return;
      }

      if (!payment) {
        this.logger.warn(`Payment tidak ditemukan untuk providerOrderId ${notification.order_id}`);
        return;
      }

      // Jangan proses jika payment sudah final
      if (payment.status !== PaymentStatus.PENDING) {
        return;
      }

      // Cocokkan nominal
      const notifAmount = Math.round(parseFloat(notification.gross_amount));
      const paymentAmount = Math.round(Number(payment.grossAmount));
      if (notifAmount !== paymentAmount) {
        this.logger.warn(
          `Nominal tidak cocok: webhook ${notifAmount}, payment ${paymentAmount} untuk ${notification.order_id}`,
        );
        return;
      }

      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: newPaymentStatus,
          providerTransactionId: notification.transaction_id,
          method: notification.payment_type,
          paidAt: isSuccess ? new Date() : undefined,
        },
      });

      // Tandai event sebagai processed
      await tx.paymentWebhookEvent.update({
        where: { providerEventId: notification.transaction_id },
        data: { processedAt: new Date() },
      });

      // Jika sukses, update order status ke PAID
      if (isSuccess && payment.order.status === OrderStatus.AWAITING_PAYMENT) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: OrderStatus.PAID,
            paidAt: new Date(),
          },
        });

        await tx.orderStatusLog.create({
          data: {
            orderId: payment.orderId,
            status: OrderStatus.PAID,
            actor: 'SYSTEM',
            note: `Pembayaran ${notification.payment_type} diterima via Midtrans`,
          },
        });
      }
    });
  }

  // ─── Customer: Status pembayaran (FR-42) ──────────────────────────

  async getMyPaymentStatus(
    userId: string,
    orderId: string,
  ): Promise<PaymentResponseDto | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return null;
    }

    // Rekonsiliasi jika masih PENDING (FR-42)
    if (payment.status === PaymentStatus.PENDING) {
      try {
        const status = await this.midtrans.getTransactionStatus(payment.providerOrderId);
        const newStatus = this.midtrans.mapToPaymentStatus(
          status.transaction_status,
          status.fraud_status,
        );
        const isSuccess = this.midtrans.isPaymentSuccess(
          status.transaction_status,
          status.fraud_status,
        );

        if (newStatus !== 'PENDING') {
          // Update lokal
          const updated = await this.prisma.$transaction(async (tx) => {
            const p = await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: newStatus,
                providerTransactionId: status.transaction_id,
                method: status.payment_type,
                paidAt: isSuccess ? new Date() : undefined,
              },
            });

            if (isSuccess && order.status === OrderStatus.AWAITING_PAYMENT) {
              await tx.order.update({
                where: { id: order.id },
                data: { status: OrderStatus.PAID, paidAt: new Date() },
              });

              await tx.orderStatusLog.create({
                data: {
                  orderId: order.id,
                  status: OrderStatus.PAID,
                  actor: 'SYSTEM',
                  note: 'Pembayaran dikonfirmasi via rekonsiliasi Midtrans',
                },
              });
            }

            return p;
          });

          return PaymentResponseDto.from(updated);
        }
      } catch (err) {
        // Rekonsiliasi gagal: lanjutkan return data terakhir
        this.logger.warn(`Rekonsiliasi gagal untuk ${payment.providerOrderId}: ${String(err)}`);
      }
    }

    return PaymentResponseDto.from(payment);
  }

  // ─── Admin: Daftar pembayaran (FR-43) ─────────────────────────────

  async findAllAdmin(
    query: QueryPaymentsDto,
  ): Promise<{ data: PaymentResponseDto[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (query.status) {
      where.status = query.status as PaymentStatus;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        // End-of-day: sertakan seluruh hari tanggal akhir
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, payments] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: payments.map((p) => PaymentResponseDto.from(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Admin: Pembayaran per order (FR-43) ──────────────────────────

  async findOrderPaymentsAdmin(orderId: string): Promise<PaymentResponseDto[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => PaymentResponseDto.from(p));
  }

  // ─── Admin: Tandai bayar tunai / walk-in (FR-45) ──────────────────

  async markPaidCash(adminId: string, orderId: string): Promise<PaymentResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    // Hanya untuk walk-in (tanpa userId)
    if (order.userId) {
      throw new BadRequestException('Fitur ini hanya untuk pesanan walk-in (tanpa akun)');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new ConflictException('Pesanan harus berstatus AWAITING_PAYMENT');
    }

    if (!order.totalPrice) {
      throw new BadRequestException('Harga pesanan belum ditetapkan');
    }

    // Cek sudah ada payment PAID
    const paidPayment = order.payments.find((p) => p.status === PaymentStatus.PAID);
    if (paidPayment) {
      throw new ConflictException('Pesanan ini sudah terbayar');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: 'cash',
          providerOrderId: `CASH-${order.code}-${Date.now()}`,
          grossAmount: Number(order.totalPrice),
          method: 'CASH',
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PAID,
          actor: 'ADMIN',
          changedByUserId: adminId,
          note: 'Pembayaran tunai (walk-in)',
        },
      });

      return p;
    });

    return PaymentResponseDto.from(payment);
  }
}
