import 'server-only';
import { DemoReceiptProvider, OpenAIReceiptProvider, type DemoReceiptFixture } from './extraction';
import { DemoPayoutProvider, PayPalSandboxProvider } from './paypal';
import { ProviderError, type PayoutProvider, type ReceiptProvider } from './types';

export type {
  PayoutProvider,
  PayoutSubmission,
  ReceiptDocument,
  ReceiptProvider,
  ReceiptRequest,
} from './types';
export { ProviderError } from './types';
export { DemoReceiptProvider, OpenAIReceiptProvider } from './extraction';
export { DemoPayoutProvider, PayPalSandboxProvider } from './paypal';

export function getReceiptProvider(options: {
  mode: 'demo' | 'sandbox';
  fixtures?: readonly DemoReceiptFixture[];
}): ReceiptProvider {
  if (options.mode === 'demo') return new DemoReceiptProvider(options.fixtures);
  if (
    options.mode !== 'sandbox' ||
    (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== 'openai')
  )
    throw new ProviderError(
      'AI_NOT_CONFIGURED',
      'Only the configured OpenAI receipt provider is supported.',
    );
  return new OpenAIReceiptProvider({
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? '',
  });
}

export function getPayoutProvider(mode: 'demo' | 'sandbox'): PayoutProvider {
  if (mode === 'demo') return new DemoPayoutProvider();
  if (mode !== 'sandbox')
    throw new ProviderError('MODE_MISMATCH', 'Select demo or Sandbox mode explicitly.');
  return new PayPalSandboxProvider({
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  });
}
