import 'server-only';
import {
  DemoReceiptProvider,
  DeepSeekReceiptProvider,
  OpenAIReceiptProvider,
  type DemoReceiptFixture,
} from './extraction';
import { DemoPayoutProvider, PayPalSandboxProvider } from './paypal';
import {
  ProviderError,
  type PayoutProvider,
  type ReceiptProvider,
} from './types';

export type {
  PayoutProvider,
  PayoutSubmission,
  ReceiptDocument,
  ReceiptProvider,
  ReceiptRequest,
} from './types';
export { ProviderError } from './types';
export {
  DemoReceiptProvider,
  DeepSeekReceiptProvider,
  OpenAIReceiptProvider,
} from './extraction';
export { DemoPayoutProvider, PayPalSandboxProvider } from './paypal';

export function getReceiptProvider(options: {
  mode: 'demo' | 'sandbox';
  fixtures?: readonly DemoReceiptFixture[];
}): ReceiptProvider {
  if (options.mode === 'demo') return new DemoReceiptProvider(options.fixtures);
  if (
    options.mode !== 'sandbox' ||
    (process.env.AI_PROVIDER &&
      !['openai', 'deepseek'].includes(process.env.AI_PROVIDER))
  )
    throw new ProviderError(
      'AI_NOT_CONFIGURED',
      'Configure an OpenAI or DeepSeek receipt provider.',
    );
  const ReceiptProvider =
    process.env.AI_PROVIDER === 'deepseek'
      ? DeepSeekReceiptProvider
      : OpenAIReceiptProvider;
  return new ReceiptProvider({
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? '',
  });
}

export function getPayoutProvider(mode: 'demo' | 'sandbox'): PayoutProvider {
  if (mode === 'demo') return new DemoPayoutProvider();
  if (mode !== 'sandbox')
    throw new ProviderError(
      'MODE_MISMATCH',
      'Select demo or Sandbox mode explicitly.',
    );
  return new PayPalSandboxProvider({
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  });
}
