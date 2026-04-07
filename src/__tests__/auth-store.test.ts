import { describe, it, expect, beforeEach } from 'vitest';
import { authStore } from '../common/net/auth-store.js';

describe('AuthStore', () => {
  const entry = {
    accountId: 1,
    loginId1: 12345,
    loginId2: 67890,
    sex: 0,
    ip: '127.0.0.1',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    authStore.remove(1);
  });

  it('should register and validate a session', () => {
    authStore.register(entry);
    expect(authStore.validate(1, 12345, 67890)).toBe(true);
  });

  it('should reject mismatched loginId1', () => {
    authStore.register(entry);
    expect(authStore.validate(1, 99999, 67890)).toBe(false);
  });

  it('should reject mismatched loginId2', () => {
    authStore.register(entry);
    expect(authStore.validate(1, 12345, 99999)).toBe(false);
  });

  it('should reject non-existent account', () => {
    expect(authStore.validate(999, 12345, 67890)).toBe(false);
  });

  it('should consume and remove a session', () => {
    authStore.register(entry);
    const consumed = authStore.consume(1);
    expect(consumed).toBeDefined();
    expect(consumed!.accountId).toBe(1);
    expect(authStore.validate(1, 12345, 67890)).toBe(false);
  });
});
