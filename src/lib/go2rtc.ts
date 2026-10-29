// Akses API go2rtc (relay WebRTC) dari server. Kredensial hanya di env server.
// GO2RTC_URL contoh: http://go2rtc:1984 (jaringan internal Dokploy).

const DEFAULT_TIMEOUT_MS = 10_000;

export class Go2rtcNotConfiguredError extends Error {
  constructor() {
    super('GO2RTC_URL is not configured');
    this.name = 'Go2rtcNotConfiguredError';
  }
}

export async function go2rtcFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const baseUrl = process.env.GO2RTC_URL;
  if (!baseUrl) {
    throw new Go2rtcNotConfiguredError();
  }

  const headers = new Headers(init.headers);
  const apiUser = process.env.GO2RTC_API_USER;
  const apiPass = process.env.GO2RTC_API_PASS;
  if (apiUser && apiPass) {
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(`${apiUser}:${apiPass}`).toString('base64')}`
    );
  }

  return fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
}
