import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import sharp from 'sharp';

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    setCookie: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    deleteCookie: vi.fn((name: string) => {
      values.delete(name);
    }),
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    createServerClient: vi.fn(),
  };
});
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (mocks.values.has(name) ? { value: mocks.values.get(name) } : undefined),
    getAll: () => [...mocks.values].map(([name, value]) => ({ name, value })),
    set: mocks.setCookie,
    delete: mocks.deleteCookie,
  }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => {
    mocks.createServerClient(...args);
    return {
      auth: {
        getUser: mocks.getUser,
        signInWithPassword: mocks.signInWithPassword,
        signOut: mocks.signOut,
      },
    };
  },
}));

import { appMode, assertSameOrigin, requestOrigin } from '../src/lib/server/config';
import { sessionUserId, signIn, signOut } from '../src/lib/server/auth';
import { MAX_FILE_BYTES, readStoredFile, storeFile, validateUpload } from '../src/lib/server/files';

let testDataDir: string;
beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv('APP_MODE', 'demo');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('NETLIFY', '');
  testDataDir = await mkdtemp(path.join(tmpdir(), 'carry-boundary-test-'));
  vi.stubEnv('LOCAL_DATA_DIR', testDataDir);
  mocks.values.clear();
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(testDataDir, { recursive: true, force: true });
});

describe('server configuration and mutation origin boundary', () => {
  it('requires an explicit demo/Sandbox mode and rejects Live/implicit fallback', () => {
    expect(appMode()).toBe('demo');
    vi.stubEnv('APP_MODE', 'sandbox');
    expect(appMode()).toBe('sandbox');
    vi.stubEnv('APP_MODE', 'live');
    expect(() => appMode()).toThrow();
    vi.stubEnv('APP_MODE', '');
    expect(() => appMode()).toThrow();
  });

  it('rejects local demo mode on configured public hosting', () => {
    vi.stubEnv('VERCEL', '1');
    expect(() => appMode()).toThrow('public deployment');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('NETLIFY', 'true');
    expect(() => appMode()).toThrow('public deployment');
  });

  it('accepts mutations only from the exact application origin', () => {
    const url = 'http://127.0.0.1:3107/api/claims';
    expect(() =>
      assertSameOrigin(
        new Request(url, { method: 'POST', headers: { origin: 'http://127.0.0.1:3107' } }),
      ),
    ).not.toThrow();
    for (const origin of [
      'https://attacker.test',
      'null',
      'http://localhost:3107',
      'http://127.0.0.1:3000',
    ]) {
      expect(() =>
        assertSameOrigin(new Request(url, { method: 'POST', headers: { origin } })),
      ).toThrow('application');
    }
    expect(() => assertSameOrigin(new Request(url, { method: 'POST' }))).toThrow('application');
  });

  it('uses the validated browser Host when Next normalizes the internal URL to localhost', () => {
    const internalUrl = 'http://localhost:3107/api/claims';
    const browserRequest = new Request(internalUrl, {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3107',
        origin: 'http://127.0.0.1:3107',
        'x-forwarded-host': 'untrusted.example.test',
      },
    });
    expect(requestOrigin(browserRequest)).toBe('http://127.0.0.1:3107');
    expect(() => assertSameOrigin(browserRequest)).not.toThrow();
    expect(() =>
      assertSameOrigin(
        new Request(internalUrl, {
          method: 'POST',
          headers: {
            host: '127.0.0.1:3107',
            origin: 'http://localhost:3107',
          },
        }),
      ),
    ).toThrow('application');
  });

  it('rejects a public Host even when the internal URL and forwarded host are loopback', () => {
    const request = new Request('http://localhost:3107/api/claims', {
      method: 'POST',
      headers: {
        host: 'public-demo.example.test',
        origin: 'http://public-demo.example.test',
        'x-forwarded-host': '127.0.0.1:3107',
      },
    });
    expect(() => requestOrigin(request)).toThrow('this computer');
    expect(() => assertSameOrigin(request)).toThrow('this computer');
  });

  it('rejects public demo hostnames and uses configured Sandbox origin rather than incoming host headers', () => {
    expect(() =>
      requestOrigin(new Request('https://public-demo.example.test/api/bootstrap')),
    ).toThrow('this computer');
    expect(requestOrigin(new Request('http://[::1]:3107/api/bootstrap'))).toBe('http://[::1]:3107');
    vi.stubEnv('APP_MODE', 'sandbox');
    vi.stubEnv('APP_ORIGIN', 'https://carry.example.test');
    expect(() =>
      assertSameOrigin(
        new Request('https://host-attacker.test/api/claims', {
          headers: { origin: 'https://host-attacker.test' },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Request('https://carry.example.test/api/claims', {
          headers: { origin: 'https://carry.example.test' },
        }),
      ),
    ).not.toThrow();
  });
});

describe('server session boundary', () => {
  it('creates a signed HttpOnly demo session and rejects a forged role/user identity', async () => {
    await signIn({ demoUserId: 'alex' });
    expect(await sessionUserId()).toBe('alex');
    expect(mocks.setCookie).toHaveBeenCalledWith(
      'carry_demo_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }),
    );
    const token = mocks.values.get('carry_demo_session')!;
    mocks.values.set('carry_demo_session', token.replace(/^alex\./, 'morgan.'));
    await expect(sessionUserId()).rejects.toMatchObject({ status: 401 });
    await expect(signIn({ demoUserId: 'unprovisioned-reviewer' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects a tampered expiry and removes the session on sign-out', async () => {
    await signIn({ demoUserId: 'sam' });
    const token = mocks.values.get('carry_demo_session')!;
    const [id, , mac] = token.split('.');
    mocks.values.set('carry_demo_session', `${id}.9999999999999.${mac}`);
    await expect(sessionUserId()).rejects.toMatchObject({ status: 401 });
    await signOut();
    await expect(sessionUserId()).rejects.toMatchObject({ status: 401 });
  });

  it('Sandbox identity comes from verified Supabase getUser and cannot use demo cookies', async () => {
    await signIn({ demoUserId: 'morgan' });
    vi.stubEnv('APP_MODE', 'sandbox');
    vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
    await expect(sessionUserId()).rejects.toMatchObject({ status: 401 });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'verified-user', user_metadata: { role: 'reviewer' } } },
      error: null,
    });
    expect(await sessionUserId()).toBe('verified-user');
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      'https://test-project.supabase.co',
      'test-publishable-key',
      expect.any(Object),
    );
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });
});

async function pdf(pages = 1, active = false) {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i++) document.addPage();
  if (active)
    document.catalog.set(
      PDFName.of('OpenAction'),
      document.context.obj({ S: PDFName.of('JavaScript'), JS: PDFString.of('app.alert(1)') }),
    );
  return document.save();
}

describe('receipt upload and private local storage boundary', () => {
  it('identifies actual content and sanitizes names instead of trusting filename extensions', async () => {
    const bytes = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const metadata = await validateUpload(bytes, '../../receipt\u0000.pdf');
    expect(metadata).toMatchObject({
      name: 'receipt.pdf',
      mediaType: 'image/png',
      pages: 1,
      size: bytes.length,
    });
    expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects empty, oversize, non-image and truncated masquerading files', async () => {
    for (const bytes of [
      new Uint8Array(),
      new Uint8Array(MAX_FILE_BYTES + 1),
      Buffer.from('<svg><script>alert(1)</script></svg>'),
      Buffer.from('%PDF-this-is-not-a-pdf'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ]) {
      await expect(validateUpload(bytes, 'receipt.png')).rejects.toMatchObject({ status: 400 });
    }
  });

  it('enforces image pixel limits even when compressed bytes are small', async () => {
    const bytes = await sharp({
      create: { width: 6500, height: 6500, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    expect(bytes.byteLength).toBeLessThan(MAX_FILE_BYTES);
    await expect(validateUpload(bytes, 'receipt.png')).rejects.toMatchObject({ code: 'FILE_TYPE' });
  });

  it('supports five PDF pages and rejects six pages', async () => {
    expect(await validateUpload(await pdf(5), 'receipt.pdf')).toMatchObject({
      mediaType: 'application/pdf',
      pages: 5,
    });
    await expect(validateUpload(await pdf(6), 'receipt.pdf')).rejects.toMatchObject({
      code: 'PDF_INVALID',
    });
  });

  it('rejects PDFs declaring encryption and PDFs without pages', async () => {
    const encrypted = await PDFDocument.create();
    encrypted.addPage();
    encrypted.context.trailerInfo.Encrypt = encrypted.context.register(
      encrypted.context.obj({ Filter: PDFName.of('Standard') }),
    );
    await expect(
      validateUpload(await encrypted.save(), 'locked-receipt.pdf'),
    ).rejects.toMatchObject({ code: 'PDF_INVALID' });
    const empty = await PDFDocument.create();
    await expect(
      validateUpload(await empty.save({ addDefaultPage: false }), 'empty.pdf'),
    ).rejects.toMatchObject({ code: 'PDF_INVALID' });
  });

  it('rejects active actions hidden inside compressed PDF object streams', async () => {
    const active = await pdf(1, true);
    expect(Buffer.from(active).toString('latin1')).not.toContain('/JavaScript');
    await expect(validateUpload(active, 'receipt.pdf')).rejects.toMatchObject({
      code: 'PDF_INVALID',
    });
  });

  it('stores immutable receipt bytes privately and blocks traversal keys', async () => {
    const bytes = await pdf();
    const metadata = await validateUpload(bytes, 'receipt.pdf');
    const stored = await storeFile('org-1', 'claim-1', bytes, metadata);
    expect(stored.storageKey).toMatch(/^org-1\/claim-1\/[a-f0-9-]+\.pdf$/);
    expect(await readStoredFile(stored.storageKey)).toEqual(bytes);
    expect(await readFile(path.join(testDataDir, 'receipts', stored.storageKey))).toEqual(
      Buffer.from(bytes),
    );
    await expect(readStoredFile('../../session-secret')).rejects.toThrow('Invalid storage key');
  });
});
