import { scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string, salt: string): string {
  const buf = scryptSync(password, salt, 64);
  return buf.toString('hex');
}

export function verifyPassword(password: string, passwordHash: string, salt: string): boolean {
  const nextHash = hashPassword(password, salt);

  const a = Buffer.from(passwordHash, 'hex');
  const b = Buffer.from(nextHash, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  const aBytes = Uint8Array.from(a);
  const bBytes = Uint8Array.from(b);

  return timingSafeEqual(aBytes, bBytes);
}
