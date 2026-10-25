import { MidtransService } from './midtrans.service.js';

describe('MidtransService', () => {
  const service = new MidtransService();

  describe('mapToPaymentStatus', () => {
    it('capture + fraud accept → PAID', () => {
      expect(service.mapToPaymentStatus('capture', 'accept')).toBe('PAID');
    });

    it('capture + fraud deny → FAILED', () => {
      expect(service.mapToPaymentStatus('capture', 'deny')).toBe('FAILED');
    });

    it('capture + fraud challenge → PENDING (tunggu review manual)', () => {
      expect(service.mapToPaymentStatus('capture', 'challenge')).toBe('PENDING');
    });

    it('settlement → PAID', () => {
      expect(service.mapToPaymentStatus('settlement')).toBe('PAID');
    });

    it('deny/failure → FAILED', () => {
      expect(service.mapToPaymentStatus('deny')).toBe('FAILED');
      expect(service.mapToPaymentStatus('failure')).toBe('FAILED');
    });

    it('expire → EXPIRED, cancel → CANCELLED', () => {
      expect(service.mapToPaymentStatus('expire')).toBe('EXPIRED');
      expect(service.mapToPaymentStatus('cancel')).toBe('CANCELLED');
    });

    it('status tidak dikenal → PENDING', () => {
      expect(service.mapToPaymentStatus('pending')).toBe('PENDING');
      expect(service.mapToPaymentStatus('')).toBe('PENDING');
    });
  });

  describe('isPaymentSuccess', () => {
    it('settlement → sukses', () => {
      expect(service.isPaymentSuccess('settlement')).toBe(true);
    });

    it('capture + accept → sukses', () => {
      expect(service.isPaymentSuccess('capture', 'accept')).toBe(true);
    });

    it('capture + deny/challenge → gagal', () => {
      expect(service.isPaymentSuccess('capture', 'deny')).toBe(false);
      expect(service.isPaymentSuccess('capture', 'challenge')).toBe(false);
    });

    it('status non-sukses → gagal', () => {
      expect(service.isPaymentSuccess('pending')).toBe(false);
      expect(service.isPaymentSuccess('expire')).toBe(false);
    });
  });
});
