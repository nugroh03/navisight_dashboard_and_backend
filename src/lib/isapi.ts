import { createHash, randomBytes } from 'crypto';

// Klien ISAPI Hikvision (HTTP Digest Auth) untuk PTZ/audio.
// Kredensial kamera dari env server: CAM_ISAPI_USER / CAM_ISAPI_PASS (sama untuk semua kamera).
// Kamera dijangkau dari VPS lewat Tailscale (ACL: tag:vps -> IP kamera tcp:80).

const DEFAULT_TIMEOUT_MS = 5_000;

export class IsapiNotConfiguredError extends Error {
  constructor() {
    super('CAM_ISAPI_USER / CAM_ISAPI_PASS are not configured');
    this.name = 'IsapiNotConfiguredError';
  }
}

const md5 = (value: string) => createHash('md5').update(value).digest('hex');

// Hanya izinkan IPv4 privat agar field isapiHost tidak bisa dipakai untuk
// membuat server menghubungi alamat publik/sembarang (SSRF).
export const isPrivateIPv4 = (host: string) => {
  const parts = host.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
};

const parseDigestChallenge = (header: string) => {
  const params: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]*)"|([^\s,]*))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    params[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
  }
  return params;
};

export async function isapiRequest(
  host: string,
  path: string,
  init: { method?: string; body?: string } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const user = process.env.CAM_ISAPI_USER;
  const pass = process.env.CAM_ISAPI_PASS;
  if (!user || !pass) {
    throw new IsapiNotConfiguredError();
  }
  if (!isPrivateIPv4(host)) {
    throw new Error(`ISAPI host must be a private IPv4 address: ${host}`);
  }

  const method = init.method ?? 'GET';
  const url = `http://${host}${path}`;
  const baseHeaders: Record<string, string> = init.body
    ? { 'Content-Type': 'application/xml' }
    : {};

  const first = await fetch(url, {
    method,
    headers: baseHeaders,
    body: init.body,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const challenge = first.headers.get('www-authenticate');
  if (first.status !== 401 || !challenge?.toLowerCase().startsWith('digest')) {
    return first;
  }
  // Buang body respons 401 sebelum mengirim ulang.
  await first.arrayBuffer().catch(() => undefined);

  const { realm = '', nonce = '', qop, opaque } = parseDigestChallenge(
    challenge
  );
  const useQop = qop
    ?.split(',')
    .map((q) => q.trim())
    .includes('auth');
  const nc = '00000001';
  const cnonce = randomBytes(8).toString('hex');
  const ha1 = md5(`${user}:${realm}:${pass}`);
  const ha2 = md5(`${method}:${path}`);
  const response = useQop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  const authorization = [
    `Digest username="${user}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${path}"`,
    'algorithm=MD5',
    `response="${response}"`,
    ...(useQop ? ['qop=auth', `nc=${nc}`, `cnonce="${cnonce}"`] : []),
    ...(opaque ? [`opaque="${opaque}"`] : []),
  ].join(', ');

  return fetch(url, {
    method,
    headers: { ...baseHeaders, Authorization: authorization },
    body: init.body,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
}
