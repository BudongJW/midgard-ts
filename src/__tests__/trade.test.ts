import { describe, it, expect } from 'vitest';
import {
  requestTrade, acceptTrade, declineTrade,
  cancelTrade, getTradeSession, isTrading,
  setTradeZeny, lockTrade,
} from '../map/trade/trade-handler.js';

describe('Trade System', () => {
  it('should create a trade request', () => {
    const ok = requestTrade(6001, 1, 'Player1', 6002, 2, 'Player2');
    expect(ok).toBe(true);
  });

  it('should accept a trade request', () => {
    const session = acceptTrade(6002, 2, 'Player2');
    expect(session).not.toBeNull();
    expect(session!.accountId1).toBe(6001);
    expect(session!.accountId2).toBe(6002);
  });

  it('should report both as trading', () => {
    expect(isTrading(6001)).toBe(true);
    expect(isTrading(6002)).toBe(true);
  });

  it('should set zeny offer', () => {
    expect(setTradeZeny(6001, 5000)).toBe(true);
    const session = getTradeSession(6001)!;
    expect(session.zeny1).toBe(5000);
  });

  it('should cancel trade', () => {
    expect(cancelTrade(6001)).toBe(true);
    expect(isTrading(6001)).toBe(false);
    expect(isTrading(6002)).toBe(false);
  });

  it('should decline a pending request', () => {
    requestTrade(6010, 10, 'A', 6011, 11, 'B');
    expect(declineTrade(6011)).toBe(true);
  });

  it('should reject duplicate trade while already trading', () => {
    requestTrade(6020, 20, 'X', 6021, 21, 'Y');
    acceptTrade(6021, 21, 'Y');
    // X is now trading, can't start another
    const ok = requestTrade(6020, 20, 'X', 6030, 30, 'Z');
    expect(ok).toBe(false);
    cancelTrade(6020);
  });
});
