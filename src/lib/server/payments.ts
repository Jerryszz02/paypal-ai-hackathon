import 'server-only';
import type { PaymentIntent } from '@/lib/types';
import type { ReimbursementService } from '@/lib/domain/service';
import { getPayoutProvider, ProviderError } from '@/lib/providers';
import { appMode } from './config';

/** Runs only durable, already-authorized intents. Provider calls stay outside SQL transactions. */
export async function processPayment(service: ReimbursementService, id: string): Promise<void> {
  const provider = getPayoutProvider(appMode()); // Configuration checked before freezing an intent.
  const job = await service.acquirePayment(id);
  if (!job) return;
  let intent = job.intent;
  try {
    if (job.action === 'send' || !intent.providerBatchId) {
      const result = await provider.createPayout(intent);
      intent = await service.recordPaymentSubmission(id, result);
      if (!intent.providerBatchId) return;
      // Do not combine receipt of a request with the statement that money arrived.
      if (job.action === 'send') return;
    }
    await service.recordPaymentResult(id, await provider.reconcilePayout(intent));
  } catch (error) {
    await service.recordPaymentUnknown(
      id,
      error instanceof ProviderError ? error.code : 'PROVIDER_QUERY_FAILED',
    );
  }
}
export async function reconcilePayment(service: ReimbursementService, intent: PaymentIntent) {
  // Final-success items can later return; a read-only query remains available.
  if (intent.status === 'paid' && intent.providerBatchId) {
    const result = await getPayoutProvider(appMode()).reconcilePayout(intent);
    await service.recordPaymentResult(intent.id, result);
    return;
  }
  await processPayment(service, intent.id);
}
