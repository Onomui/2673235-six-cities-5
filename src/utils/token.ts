import { createHmac, timingSafeEqual } from 'node:crypto';

export function signToken(userId: string, email: string, secret: string, ttlSeconds = 60 * 60 * 24): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = JSON.stringify({ userId, email, exp });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');

  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyToken(token: string, secret: string): { userId: string; email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, sigB64] = parts;
  const expectedSigB64 = createHmac('sha256', secret).update(payloadB64).digest('base64url');

  const a = Buffer.from(sigB64, 'utf8');
  const b = Buffer.from(expectedSigB64, 'utf8');

  if (a.length !== b.length) {
    return null;
  }

  if (!timingSafeEqual(a as unknown as Uint8Array, b as unknown as Uint8Array)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      userId: string;
      email: string;
      exp: number;
    };

    if (!payload.userId || !payload.email || !payload.exp) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
