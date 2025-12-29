import { SignJWT, jwtVerify } from 'jose';

export type TokenPayload = {
  userId: string;
  email: string;
};

const encoder = new TextEncoder();

export async function signToken(
  userId: string,
  email: string,
  secret: string,
  ttlSeconds = 60 * 60 * 24
): Promise<string> {
  const key = encoder.encode(secret);
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;

  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const key = encoder.encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });

    const userId = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : null;

    if (!userId || !email) {
      return null;
    }

    return { userId, email };
  } catch {
    return null;
  }
}
