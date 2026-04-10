import { describe, it, expect } from 'vitest';
import {
  createParty, addMember, removeMember,
  getPartyByAccount, calcPartyExp, ExpShareType, setExpShare,
} from '../map/party/party-manager.js';

describe('PartyManager', () => {
  it('should create a party', () => {
    const party = createParty('TestParty', 9001, 1, 'Leader', 'prontera');
    expect(party).not.toBeNull();
    expect(party!.name).toBe('TestParty');
    expect(party!.members.length).toBe(1);
    expect(party!.members[0].leader).toBe(true);
  });

  it('should not allow duplicate party join', () => {
    // Account 9001 is already in a party from previous test
    const party2 = createParty('Duplicate', 9001, 1, 'Leader', 'prontera');
    expect(party2).toBeNull();
  });

  it('should add members', () => {
    const party = getPartyByAccount(9001);
    expect(party).toBeDefined();
    const ok = addMember(party!.id, 9002, 2, 'Member1', 'prontera');
    expect(ok).toBe(true);
    expect(party!.members.length).toBe(2);
  });

  it('should calculate even EXP share', () => {
    const party = getPartyByAccount(9001);
    expect(party).toBeDefined();

    // Update positions to be on same map, near each other
    party!.members[0].x = 100;
    party!.members[0].y = 100;
    party!.members[1].map = 'prontera';
    party!.members[1].x = 110;
    party!.members[1].y = 110;

    const shares = calcPartyExp(9001, 100, 50, 'prontera');
    expect(shares.length).toBe(2);
    // With 2 members: bonus = 1.05, each gets 100*1.05/2 = 52
    expect(shares[0].baseExp).toBe(52);
    expect(shares[1].baseExp).toBe(52);
  });

  it('should give full EXP in EACH_TAKE mode', () => {
    const party = getPartyByAccount(9001);
    setExpShare(party!.id, 9001, ExpShareType.EACH_TAKE);
    const shares = calcPartyExp(9001, 100, 50, 'prontera');
    expect(shares.length).toBe(1);
    expect(shares[0].baseExp).toBe(100);
  });

  it('should remove members and disband when empty', () => {
    removeMember(9002);
    const party = getPartyByAccount(9001);
    expect(party).toBeDefined();
    expect(party!.members.length).toBe(1);

    removeMember(9001);
    expect(getPartyByAccount(9001)).toBeUndefined();
  });
});
