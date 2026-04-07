/**
 * MidgardTS Crypto Utilities
 * Password hashing and verification
 * rAthena uses MD5 for legacy compatibility; we use modern bcrypt-style hashing
 * but also support MD5 for client protocol compatibility
 */

import { createHash, randomBytes } from 'node:crypto';

export function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = createHash('sha256').update(salt + password).digest('hex');
  return computed === hash;
}

export function generateSessionId(): number {
  return randomBytes(4).readUInt32LE(0);
}
