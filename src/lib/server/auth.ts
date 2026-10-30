import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appMode, HttpError, localDataDir, requiredEnv } from './config';

const DEMO_COOKIE = 'carry_demo_session';
async function demoSecret() {
  const dir = localDataDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'session-secret');
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try {
      await writeFile(file, randomBytes(48), { flag: 'wx', mode: 0o600 });
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError;
    }
    return readFile(file);
  }
}
export async function supabaseAuth() {
  const jar = await cookies();
  return createServerClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_PUBLISHABLE_KEY'), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) =>
        items.forEach(({ name, value, options }) =>
          jar.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.APP_ORIGIN?.startsWith('https://'),
          }),
        ),
    },
  });
}
export async function sessionUserId(): Promise<string> {
  if (appMode() === 'sandbox') {
    const supabase = await supabaseAuth();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    return data.user.id;
  }
  const token = (await cookies()).get(DEMO_COOKIE)?.value;
  if (token) {
    const [id, expiry, mac] = token.split('.');
    if (id && /^\d+$/.test(expiry || '') && Number(expiry) > Date.now() && mac) {
      const expected = createHmac('sha256', await demoSecret())
        .update(`${id}.${expiry}`)
        .digest();
      const supplied = Buffer.from(mac, 'base64url');
      if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return id;
    }
  }
  throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
}
export async function signIn(input: { demoUserId?: string; email?: string; password?: string }) {
  if (appMode() === 'demo') {
    if (!['alex', 'sam', 'morgan'].includes(input.demoUserId || ''))
      throw new HttpError(400, 'INVALID_ACCOUNT', 'Choose one of the local demo accounts.');
    const payload = `${input.demoUserId}.${Date.now() + 12 * 60 * 60 * 1000}`;
    const signature = createHmac('sha256', await demoSecret())
      .update(payload)
      .digest('base64url');
    (await cookies()).set(DEMO_COOKIE, `${payload}.${signature}`, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60,
      secure: false,
    });
    return;
  }
  if (!input.email || !input.password)
    throw new HttpError(400, 'LOGIN_REQUIRED', 'Enter your email and password.');
  const { error } = await (
    await supabaseAuth()
  ).auth.signInWithPassword({ email: input.email, password: input.password });
  if (error)
    throw new HttpError(401, 'LOGIN_FAILED', 'Sign-in failed. Check your email and password.');
}
export async function signOut() {
  if (appMode() === 'demo') (await cookies()).delete(DEMO_COOKIE);
  else await (await supabaseAuth()).auth.signOut();
}
