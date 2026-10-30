import type { Extraction, PaymentIntent, VerifiedPaymentResult } from '../types';

/** Bytes are loaded by the server after checking attachment ownership. Never accept remote URLs. */
export interface ReceiptDocument {
  id: string;
  name: string;
  mediaType: 'image/jpeg' | 'image/png' | 'application/pdf';
  pages: number;
  bytes: Uint8Array;
}

export interface ReceiptRequest {
  attachments: ReceiptDocument[];
  purpose: string;
}

export interface ReceiptProvider {
  extract(request: ReceiptRequest): Promise<Extraction>;
}

export interface PayoutSubmission {
  status: 'processing' | 'unknown' | 'failed';
  providerBatchId: string | null;
  providerStatus: string;
  failureCode?: string;
}

export interface PayoutProvider {
  createPayout(intent: PaymentIntent): Promise<PayoutSubmission>;
  reconcilePayout(intent: PaymentIntent): Promise<VerifiedPaymentResult>;
  verifyWebhook(headers: Headers, event: unknown): Promise<boolean>;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
