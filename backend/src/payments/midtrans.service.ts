import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

/** Timeout default untuk request ke Midtrans (ms). */
const REQUEST_TIMEOUT_MS = 10_000;

export interface SnapTransactionRequest {
  orderId: string;
  grossAmount: number;
  customerFirstName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface SnapTransactionResponse {
  token: string;
  redirectUrl: string;
}

export interface MidtransNotification {
  order_id: string;
  transaction_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  payment_type: string;
  fraud_status?: string;
  settlement_time?: string;
  transaction_time?: string;
}

export interface TransactionStatusResponse {
  order_id: string;
  transaction_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  payment_type: string;
  fraud_status?: string;
  signature_key: string;
}

@Injectable()
export class MidtransService {
  private readonly logger = new Logger(MidtransService.name);

  private get serverKey(): string {
    const key = process.env.MIDTRANS_SERVER_KEY;
    if (!key) throw new Error('MIDTRANS_SERVER_KEY belum diatur');
    return key;
  }

  private get isProduction(): boolean {
    return process.env.MIDTRANS_IS_PRODUCTION === 'true';
  }

  private get snapBaseUrl(): string {
    return this.isProduction
      ? 'https://app.midtrans.com/snap/v1'
      : 'https://app.sandbox.midtrans.com/snap/v1';
  }

  private get apiBaseUrl(): string {
    return this.isProduction
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2';
  }

  private get authHeader(): string {
    const encoded = Buffer.from(`${this.serverKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * fetch dengan timeout via AbortController — cegah request menggantung
   * tanpa batas bila Midtrans lambat/tidak merespons.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Buat transaksi Snap → return token + redirect_url.
   */
  async createSnapTransaction(req: SnapTransactionRequest): Promise<SnapTransactionResponse> {
    const body = {
      transaction_details: {
        order_id: req.orderId,
        gross_amount: req.grossAmount,
      },
      customer_details: {
        first_name: req.customerFirstName,
        email: req.customerEmail,
        phone: req.customerPhone,
      },
    };

    const res = await this.fetchWithTimeout(`${this.snapBaseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Midtrans Snap error ${res.status}: ${text}`);
      throw new Error(`Midtrans Snap gagal: ${res.status}`);
    }

    const data = (await res.json()) as { token: string; redirect_url: string };

    return {
      token: data.token,
      redirectUrl: data.redirect_url,
    };
  }

  /**
   * Cek status transaksi di Midtrans (rekonsiliasi).
   */
  async getTransactionStatus(orderId: string): Promise<TransactionStatusResponse> {
    const res = await this.fetchWithTimeout(
      `${this.apiBaseUrl}/${encodeURIComponent(orderId)}/status`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Midtrans status error ${res.status}: ${text}`);
      throw new Error(`Midtrans status gagal: ${res.status}`);
    }

    return (await res.json()) as TransactionStatusResponse;
  }

  /**
   * Verifikasi signature_key webhook.
   * SHA512(order_id + status_code + gross_amount + ServerKey)
   */
  verifySignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    signatureKey: string,
  ): boolean {
    const input = `${orderId}${statusCode}${grossAmount}${this.serverKey}`;
    const expected = createHash('sha512').update(input).digest('hex');
    return expected === signatureKey;
  }

  /**
   * Cek apakah transaksi sukses berdasarkan notification/status.
   */
  isPaymentSuccess(transactionStatus: string, fraudStatus?: string): boolean {
    const successStatuses = ['capture', 'settlement'];
    if (!successStatuses.includes(transactionStatus)) return false;
    // Untuk capture, fraud_status harus accept
    if (transactionStatus === 'capture' && fraudStatus !== 'accept') return false;
    return true;
  }

  /**
   * Map transaction_status Midtrans ke PaymentStatus internal.
   *
   * `capture` memerlukan pengecekan fraud_status:
   * - accept    → PAID
   * - deny      → FAILED
   * - challenge → PENDING (menunggu review manual)
   */
  mapToPaymentStatus(
    transactionStatus: string,
    fraudStatus?: string,
  ): 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'PENDING' {
    switch (transactionStatus) {
      case 'capture':
        if (fraudStatus === 'accept') return 'PAID';
        if (fraudStatus === 'deny') return 'FAILED';
        return 'PENDING';
      case 'settlement':
        return 'PAID';
      case 'deny':
      case 'failure':
        return 'FAILED';
      case 'expire':
        return 'EXPIRED';
      case 'cancel':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }
}
