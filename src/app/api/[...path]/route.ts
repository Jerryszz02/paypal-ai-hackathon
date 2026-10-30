import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { getApplication } from '@/lib/server/application';
import { appMode, assertSameOrigin, HttpError, requestOrigin } from '@/lib/server/config';
import { sessionUserId, signIn, signOut } from '@/lib/server/auth';
import {
  discardOrphanFile,
  MAX_FILE_BYTES,
  readStoredFile,
  storeFile,
  validateUpload,
} from '@/lib/server/files';
import { applySample, demoFixtures, SAMPLE_NAMES } from '@/lib/server/samples';
import { processPayment, reconcilePayment } from '@/lib/server/payments';
import { DomainError } from '@/lib/domain/service';
import { getPayoutProvider, getReceiptProvider, ProviderError } from '@/lib/providers';
import type { Extraction } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
type Context = { params: Promise<{ path: string[] }> };
const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: noStore });
const version = z.number().int().positive();
async function bodyBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > maxBytes)
    throw new HttpError(
      413,
      'BODY_TOO_LARGE',
      'This upload is too large. Use at most 10 MB of receipt files.',
    );
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'BODY_TOO_LARGE', 'The request exceeds the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks));
}
async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const bytes = await bodyBytes(request, 256 * 1024);
    const data = bytes.length ? JSON.parse(Buffer.from(bytes).toString('utf8')) : {};
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('object required');
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'INVALID_JSON', 'Send a valid JSON request.');
  }
}
function workerAuthorized(request: Request) {
  const secret = process.env.WORKER_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!secret || secret.length < 32 || !token) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function serviceStatus() {
  return appMode() === 'demo'
    ? { ai: 'simulated', payments: 'simulated', database: 'local' }
    : {
        ai:
          process.env.AI_API_KEY && process.env.AI_MODEL
            ? 'configured_unverified'
            : 'not_configured',
        payments:
          process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
            ? 'configured_unverified'
            : 'not_configured',
        database: 'supabase',
      };
}
async function handle(request: Request, context: Context): Promise<Response> {
  try {
    const { path } = await context.params;
    const route = path.join('/');
    const method = request.method;
    requestOrigin(request);
    const machineEndpoint = route === 'webhooks/paypal' || route === 'worker';
    if (method !== 'GET' && !machineEndpoint) assertSameOrigin(request);
    if (route === 'auth/config' && method === 'GET') {
      const mode = appMode();
      const demoUsers =
        mode === 'demo'
          ? (await (await getApplication()).listDemoMembers()).map(({ id, name, role }) => ({
              id,
              name,
              role,
            }))
          : [];
      return json({
        mode,
        demoUsers,
        configured:
          mode === 'demo' ||
          Boolean(
            process.env.SUPABASE_URL &&
            process.env.SUPABASE_PUBLISHABLE_KEY &&
            process.env.DATABASE_URL,
          ),
      });
    }
    if (route === 'auth/login' && method === 'POST') {
      const input = z
        .object({
          demoUserId: z.string().max(100).optional(),
          email: z.email().max(254).optional(),
          password: z.string().max(1000).optional(),
        })
        .strict()
        .parse(await readJson(request));
      await signIn(input);
      return json({ ok: true });
    }
    if (route === 'auth/logout' && method === 'POST') {
      await signOut();
      return json({ ok: true });
    }
    if (route === 'worker' && method === 'POST') {
      if (!workerAuthorized(request))
        throw new HttpError(401, 'UNAUTHORIZED_WORKER', 'Worker authentication required.');
      const service = await getApplication();
      const now = new Date().toISOString();
      const jobs = (await service.listRecoverablePayments())
        .filter((job) => !job.leaseUntil || job.leaseUntil <= now)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, 3);
      // A rotating oldest-first batch prevents long-lived unknown/unclaimed items
      // from starving later intents; independent provider calls fit one invocation.
      await Promise.all(jobs.map((job) => processPayment(service, job.id)));
      return json({ processed: jobs.length });
    }
    if (route === 'webhooks/paypal' && method === 'POST') {
      if (appMode() !== 'sandbox')
        throw new HttpError(404, 'NOT_FOUND', 'Webhook endpoint is disabled in the local demo.');
      const event = await readJson(request);
      const provider = getPayoutProvider('sandbox');
      if (!(await provider.verifyWebhook(request.headers, event)))
        throw new HttpError(401, 'UNVERIFIED_WEBHOOK', 'The PayPal event could not be verified.');
      const resource = event.resource as Record<string, unknown> | undefined;
      const service = await getApplication();
      const batchId =
        typeof resource?.payout_batch_id === 'string' ? resource.payout_batch_id : undefined;
      const itemId =
        typeof resource?.payout_item_id === 'string' ? resource.payout_item_id : undefined;
      // The event only locates an existing intent. Its status or amount never updates payment state.
      const intent = batchId
        ? await service.findPaymentByProvider({ batchId })
        : itemId
          ? await service.findPaymentByProvider({ itemId })
          : null;
      if (!intent) return json({ accepted: true, matched: false });
      if (!intent.providerBatchId)
        throw new HttpError(
          503,
          'RECONCILIATION_PENDING',
          'The original payout is awaiting reconciliation.',
        );
      await service.recordPaymentResult(intent.id, await provider.reconcilePayout(intent));
      // Mark only after a successful authoritative query, so a transient error remains retryable.
      const fresh = await service.claimWebhookEvent(intent.organizationId, String(event.id));
      return json({ accepted: true, duplicate: !fresh });
    }
    const actor = await sessionUserId();
    const service = await getApplication();
    const member = await service.getMember(actor);
    if (route === 'bootstrap' && method === 'GET')
      return json({
        ...(await service.bootstrap(actor)),
        mode: appMode(),
        services: serviceStatus(),
      });
    if (route === 'export' && method === 'GET')
      return new Response(await service.exportClaims(actor), {
        headers: {
          ...noStore,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="carry-claims.csv"',
        },
      });
    if (route === 'profile' && method === 'PUT')
      return json(
        await service.updateProfile(
          actor,
          z
            .object({
              email: z.email().max(127),
              confirmed: z.literal(true),
              expectedVersion: z.number().int().min(0),
            })
            .strict()
            .parse(await readJson(request)),
        ),
      );
    if (route === 'policy' && method === 'PUT') {
      const { expectedVersion, ...input } = await readJson(request);
      return json(
        await service.updatePolicy(actor, version.parse(expectedVersion), input as never),
      );
    }
    if (route === 'claims' && method === 'POST')
      return json(await service.createDraft(actor, await readJson(request)), 201);
    if (path[0] === 'attachments' && path.length === 2 && method === 'GET') {
      const attachment = await service.getAttachment(actor, path[1]);
      const bytes = await readStoredFile(attachment.storageKey);
      return new Response(Buffer.from(bytes), {
        headers: {
          ...noStore,
          'Content-Type': attachment.mediaType,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (path[0] === 'claims' && path.length >= 2) {
      const id = path[1];
      const action = path[2];
      if (!action && method === 'GET') return json(await service.getClaim(actor, id));
      if (!action && method === 'PATCH') {
        const { expectedVersion, ...input } = await readJson(request);
        return json(await service.updateDraft(actor, id, version.parse(expectedVersion), input));
      }
      if (action === 'attachments' && path.length === 4 && method === 'DELETE') {
        const input = z
          .object({ expectedVersion: version })
          .strict()
          .parse(await readJson(request));
        return json(await service.removeAttachment(actor, id, input.expectedVersion, path[3]));
      }
      if (action === 'attachments' && method === 'POST') {
        let claim = await service.getClaim(actor, id);
        if (member.role !== 'applicant' || claim.ownerId !== actor)
          throw new HttpError(403, 'FORBIDDEN', 'Only the applicant can add receipt files.');
        const bytes = await bodyBytes(request, MAX_FILE_BYTES + 256 * 1024);
        const form = await new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: Buffer.from(bytes),
        }).formData();
        const expectedVersion = version.parse(Number(form.get('expectedVersion')));
        if (claim.version !== expectedVersion)
          throw new HttpError(
            409,
            'VERSION_CONFLICT',
            'This claim changed. Refresh before uploading.',
          );
        const files = [...form.getAll('files'), ...form.getAll('file')].filter(
          (value): value is File => value instanceof File,
        );
        if (!files.length || files.length + claim.attachments.length > 3)
          throw new HttpError(400, 'FILE_COUNT', 'Use between one and three receipt files.');
        const uploads = await Promise.all(
          files.map(async (file) => {
            const data = new Uint8Array(await file.arrayBuffer());
            return { data, metadata: await validateUpload(data, file.name) };
          }),
        );
        if (
          uploads.reduce((sum, file) => sum + file.metadata.size, 0) +
            claim.attachments.reduce((sum, file) => sum + file.size, 0) >
            MAX_FILE_BYTES ||
          uploads
            .filter((f) => f.metadata.mediaType === 'application/pdf')
            .reduce((sum, f) => sum + f.metadata.pages, 0) +
            claim.attachments
              .filter((f) => f.mediaType === 'application/pdf')
              .reduce((sum, f) => sum + f.pages, 0) >
            5
        )
          throw new HttpError(
            400,
            'UPLOAD_LIMIT',
            'Use at most 10 MB and five PDF pages per claim.',
          );
        for (const file of uploads) {
          const saved = await storeFile(claim.organizationId, id, file.data, file.metadata);
          try {
            claim = await service.addAttachment(actor, id, claim.version, saved);
          } catch (error) {
            await discardOrphanFile(saved.storageKey);
            throw error;
          }
        }
        return json(claim);
      }
      if (action === 'sample' && method === 'POST') {
        const input = z
          .object({ expectedVersion: version, sample: z.enum(SAMPLE_NAMES) })
          .strict()
          .parse(await readJson(request));
        return json(await applySample(service, actor, id, input.expectedVersion, input.sample));
      }
      if (action === 'extract' && method === 'POST') {
        const input = z
          .object({ expectedVersion: version })
          .strict()
          .parse(await readJson(request));
        const job = await service.startExtraction(actor, id, input.expectedVersion);
        if (!job.shouldRun) return json(job.claim);
        let extraction: Extraction;
        try {
          const provider = getReceiptProvider({
            mode: appMode(),
            fixtures: appMode() === 'demo' ? await demoFixtures() : undefined,
          });
          const attachments = await Promise.all(
            job.claim.attachments.map(async (file) => ({
              id: file.id,
              name: file.name,
              mediaType: file.mediaType,
              pages: file.pages,
              bytes: await readStoredFile(file.storageKey),
            })),
          );
          extraction = await provider.extract({ attachments, purpose: job.claim.purpose });
        } catch (error) {
          extraction = {
            merchant: null,
            receiptNumber: null,
            date: null,
            currency: null,
            totalMinor: null,
            items: [],
            sources: [],
            issues: [
              'Recognition could not complete. The receipt is saved for retry or finance review.',
            ],
            paidEvidence: false,
            purposeMatches: null,
            provider: appMode() === 'demo' ? 'demo' : 'openai',
            model:
              appMode() === 'demo' ? 'synthetic-fixture' : process.env.AI_MODEL || 'not-configured',
            status: 'failed',
            errorCode: error instanceof ProviderError ? error.code : 'RECOGNITION_UNAVAILABLE',
          };
        }
        return json(
          await service.saveExtraction(actor, id, input.expectedVersion, extraction, job.jobId),
        );
      }
      if (action === 'submit' && method === 'POST') {
        const input = z
          .object({ expectedVersion: version })
          .strict()
          .parse(await readJson(request));
        let claim = await service.submit(actor, id, input.expectedVersion);
        if (claim.approval?.kind === 'auto' && !claim.approval.invalidatedAt) {
          const intent = await service.preparePayment(actor, id, claim.version);
          await processPayment(service, intent.id);
          claim = await service.getClaim(actor, id);
        }
        return json(claim);
      }
      if (action === 'review' && method === 'POST') {
        const { expectedVersion, ...input } = await readJson(request);
        return json(
          await service.review(actor, id, version.parse(expectedVersion), input as never),
        );
      }
      if (action === 'reopen' && method === 'POST') {
        const input = z
          .object({ expectedVersion: version, reason: z.string().trim().min(3).max(3000) })
          .strict()
          .parse(await readJson(request));
        return json(
          await service.reopenAfterFailedPayment(actor, id, input.expectedVersion, input.reason),
        );
      }
      if (action === 'payment' && method === 'POST') {
        const input = z
          .object({ expectedVersion: version })
          .strict()
          .parse(await readJson(request));
        // Resolve configuration before creating a queued intent. This still never treats acceptance as paid.
        getPayoutProvider(appMode());
        const intent = await service.preparePayment(actor, id, input.expectedVersion);
        await processPayment(service, intent.id);
        return json(await service.getClaim(actor, id));
      }
      if (action === 'sync' && method === 'POST') {
        z.object({})
          .strict()
          .parse(await readJson(request));
        const claim = await service.getClaim(actor, id);
        if (!claim.payment)
          throw new HttpError(409, 'NO_PAYMENT', 'There is no existing payment to synchronize.');
        await reconcilePayment(service, claim.payment);
        return json(await service.getClaim(actor, id));
      }
    }
    throw new HttpError(404, 'NOT_FOUND', 'This operation was not found.');
  } catch (error) {
    if (error instanceof HttpError || error instanceof DomainError)
      return json({ error: error.message, code: error.code }, error.status);
    if (error instanceof ZodError)
      return json(
        {
          error:
            'Some fields are invalid. Check the amount, date, required confirmations and version, then try again.',
          code: 'INVALID_INPUT',
        },
        400,
      );
    if (error instanceof ProviderError)
      return json({ error: error.message, code: error.code }, 503);
    // Do not expose database URLs, provider bodies, credentials, or receipt contents in errors.
    console.error('Carry request failed', {
      kind: error instanceof Error ? error.name : 'UnknownError',
    });
    return json(
      {
        error:
          'The service could not complete this action. Your saved records are retained. Check the server configuration or try again.',
        code: 'SERVICE_UNAVAILABLE',
      },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
