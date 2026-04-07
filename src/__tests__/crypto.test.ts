import { describe, it, expect } from 'vitest';
import { md5, hashPassword, verifyPassword, generateSessionId } from '../common/crypto/index.js';

describe('Crypto', () => {
  it('should generate correct MD5 hash', () => {
    expect(md5('admin')).toBe('21232f297a57a5a743894a0e4a801fc3');
  });

  it('should hash and verify passwords', () => {
    const password = 'testpassword123';
    const hashed = hashPassword(password);
    expect(verifyPassword(password, hashed)).toBe(true);
    expect(verifyPassword('wrongpassword', hashed)).toBe(false);
  });

  it('should produce different hashes for same password (salted)', () => {
    const h1 = hashPassword('same');
    const h2 = hashPassword('same');
    expect(h1).not.toBe(h2);
    expect(verifyPassword('same', h1)).toBe(true);
    expect(verifyPassword('same', h2)).toBe(true);
  });

  it('should generate session IDs', () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(typeof id1).toBe('number');
    expect(id1).not.toBe(id2);
  });
});
