/**
 * MidgardTS Auth Store
 * Shared in-memory session store for inter-server authentication
 *
 * In rAthena, login/char/map communicate via TCP sockets.
 * Since MidgardTS runs all servers in one process, we use
 * a shared in-memory store for session validation.
 */

import { createLogger } from '../logger/index.js';

const log = createLogger('AuthStore');

export interface AuthEntry {
  accountId: number;
  loginId1: number;
  loginId2: number;
  sex: number;
  ip: string;
  createdAt: number;
}

const SESSION_TTL_MS = 60_000; // 60 seconds to connect to next server

class AuthStore {
  private entries = new Map<number, AuthEntry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 30_000);
  }

  register(entry: AuthEntry): void {
    this.entries.set(entry.accountId, entry);
    log.debug(`Session registered for account ${entry.accountId}`);
  }

  validate(accountId: number, loginId1: number, loginId2: number): boolean {
    const entry = this.entries.get(accountId);
    if (!entry) {
      log.warn(`No session found for account ${accountId}`);
      return false;
    }

    if (entry.loginId1 !== loginId1 || entry.loginId2 !== loginId2) {
      log.warn(`Session mismatch for account ${accountId}`);
      return false;
    }

    if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
      log.warn(`Session expired for account ${accountId}`);
      this.entries.delete(accountId);
      return false;
    }

    return true;
  }

  /**
   * Validate for map server: CZ_ENTER does not carry loginId2,
   * so only loginId1 is checked here.
   */
  validateForMap(accountId: number, loginId1: number): boolean {
    const entry = this.entries.get(accountId);
    if (!entry) {
      log.warn(`No session found for account ${accountId}`);
      return false;
    }

    if (entry.loginId1 !== loginId1) {
      log.warn(`Session mismatch for account ${accountId}`);
      return false;
    }

    if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
      log.warn(`Session expired for account ${accountId}`);
      this.entries.delete(accountId);
      return false;
    }

    return true;
  }

  consume(accountId: number): AuthEntry | undefined {
    const entry = this.entries.get(accountId);
    if (entry) {
      this.entries.delete(accountId);
    }
    return entry;
  }

  remove(accountId: number): void {
    this.entries.delete(accountId);
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (now - entry.createdAt > SESSION_TTL_MS) {
        this.entries.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      log.debug(`Cleaned up ${removed} expired sessions`);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.entries.clear();
  }
}

// Singleton — shared across all servers in the same process
export const authStore = new AuthStore();
