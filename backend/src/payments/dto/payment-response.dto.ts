import type { Payment, PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  id!: string;
  orderId!: string;
  provider!: string;
  providerOrderId!: string;
  providerTransactionId!: string | null;
  grossAmount!: string;
  method!: string | null;
  status!: PaymentStatus;
  paymentToken!: string | null;
  paymentUrl!: string | null;
  expiresAt!: Date | null;
  paidAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  static from(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId,
      providerTransactionId: payment.providerTransactionId,
      grossAmount: payment.grossAmount.toString(),
      method: payment.method,
      status: payment.status,
      paymentToken: payment.paymentToken,
      paymentUrl: payment.paymentUrl,
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
