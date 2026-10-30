import 'server-only';
import path from 'node:path';

export function appMode(): 'demo' | 'sandbox' {
  const mode = process.env.APP_MODE;
  if (mode !== 'demo' && mode !== 'sandbox')
    throw new Error('Set APP_MODE to demo or sandbox. Live payments are not supported.');
  if (mode === 'demo' && (process.env.VERCEL || process.env.NETLIFY))
    throw new Error('Local demo mode cannot run on a public deployment.');
  return mode;
}
// Local demo files are runtime data, never deployment assets.
export function localDataDir() {
  return path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || '.local/demo');
}
export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}.`);
  return value;
}
export function isLoopback(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  if (appMode() === 'demo') {
    // Next normalizes request.url to localhost in development, while the browser
    // can use 127.0.0.1. Validate the actual Host explicitly, never forwarded-host.
    const incoming = new URL(`${url.protocol}//${request.headers.get('host') || url.host}`);
    if (
      !isLoopback(incoming.hostname) ||
      incoming.username ||
      incoming.password ||
      incoming.pathname !== '/'
    )
      throw new HttpError(403, 'LOCAL_ONLY', 'The demo is available only on this computer.');
    return incoming.origin;
  }
  return new URL(requiredEnv('APP_ORIGIN')).origin;
}
export function assertSameOrigin(request: Request) {
  const expected = requestOrigin(request);
  if (request.headers.get('origin') !== expected)
    throw new HttpError(
      403,
      'ORIGIN',
      'This action must come from the application. Refresh and try again.',
    );
}
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
