/**
 * MidgardTS Party System
 * Party creation, member management, EXP sharing
 * Inspired by rAthena's party.cpp
 */

import { createLogger } from '../../common/logger/index.js';

const log = createLogger('Party');

const MAX_PARTY_SIZE = 12;
let nextPartyId = 1;

export enum ExpShareType {
  EACH_TAKE = 0,  // Each player gets their own EXP
  EVEN_SHARE = 1, // EXP split evenly among nearby members
}

export interface PartyMember {
  accountId: number;
  charId: number;
  charName: string;
  map: string;
  x: number;
  y: number;
  online: boolean;
  leader: boolean;
}

export interface Party {
  id: number;
  name: string;
  expShare: ExpShareType;
  itemPickup: number; // 0=each, 1=party
  members: PartyMember[];
}

const parties = new Map<number, Party>();                  // partyId -> Party
const memberToParty = new Map<number, number>();           // accountId -> partyId

/**
 * Create a new party
 */
export function createParty(
  name: string, leaderAccountId: number, leaderCharId: number, leaderName: string, map: string,
): Party | null {
  if (memberToParty.has(leaderAccountId)) {
    log.warn(`Account ${leaderAccountId} already in a party`);
    return null;
  }

  if (name.length === 0 || name.length > 24) {
    log.warn('Invalid party name');
    return null;
  }

  const party: Party = {
    id: nextPartyId++,
    name,
    expShare: ExpShareType.EVEN_SHARE,
    itemPickup: 0,
    members: [{
      accountId: leaderAccountId,
      charId: leaderCharId,
      charName: leaderName,
      map,
      x: 0, y: 0,
      online: true,
      leader: true,
    }],
  };

  parties.set(party.id, party);
  memberToParty.set(leaderAccountId, party.id);
  log.info(`Party "${name}" created by ${leaderName} (id=${party.id})`);
  return party;
}

/**
 * Add a member to a party (via invite accept)
 */
export function addMember(
  partyId: number, accountId: number, charId: number, charName: string, map: string,
): boolean {
  const party = parties.get(partyId);
  if (!party) return false;

  if (memberToParty.has(accountId)) return false;
  if (party.members.length >= MAX_PARTY_SIZE) return false;

  party.members.push({
    accountId, charId, charName, map,
    x: 0, y: 0,
    online: true, leader: false,
  });
  memberToParty.set(accountId, partyId);
  log.info(`${charName} joined party "${party.name}"`);
  return true;
}

/**
 * Remove a member from their party
 */
export function removeMember(accountId: number): boolean {
  const partyId = memberToParty.get(accountId);
  if (partyId === undefined) return false;

  const party = parties.get(partyId);
  if (!party) { memberToParty.delete(accountId); return false; }

  const idx = party.members.findIndex((m) => m.accountId === accountId);
  if (idx < 0) { memberToParty.delete(accountId); return false; }

  const wasLeader = party.members[idx].leader;
  const memberName = party.members[idx].charName;
  party.members.splice(idx, 1);
  memberToParty.delete(accountId);

  if (party.members.length === 0) {
    // Disband
    parties.delete(partyId);
    log.info(`Party "${party.name}" disbanded`);
  } else if (wasLeader) {
    // Transfer leadership
    party.members[0].leader = true;
    log.info(`Leadership transferred to ${party.members[0].charName} in party "${party.name}"`);
  }

  log.info(`${memberName} left party "${party.name}"`);
  return true;
}

/**
 * Get party by account
 */
export function getPartyByAccount(accountId: number): Party | undefined {
  const partyId = memberToParty.get(accountId);
  if (partyId === undefined) return undefined;
  return parties.get(partyId);
}

/**
 * Get party by ID
 */
export function getPartyById(id: number): Party | undefined {
  return parties.get(id);
}

/**
 * Update member position (for EXP share range check)
 */
export function updateMemberPosition(accountId: number, map: string, x: number, y: number): void {
  const partyId = memberToParty.get(accountId);
  if (partyId === undefined) return;
  const party = parties.get(partyId);
  if (!party) return;
  const member = party.members.find((m) => m.accountId === accountId);
  if (member) {
    member.map = map;
    member.x = x;
    member.y = y;
  }
}

/**
 * Set member online/offline status
 */
export function setMemberOnline(accountId: number, online: boolean): void {
  const partyId = memberToParty.get(accountId);
  if (partyId === undefined) return;
  const party = parties.get(partyId);
  if (!party) return;
  const member = party.members.find((m) => m.accountId === accountId);
  if (member) member.online = online;
}

/**
 * Calculate shared EXP for party members on the same map
 * Returns list of (accountId, expAmount) for each eligible member
 */
export function calcPartyExp(
  killerAccountId: number, baseExp: number, jobExp: number, killerMap: string,
): { accountId: number; baseExp: number; jobExp: number }[] {
  const party = getPartyByAccount(killerAccountId);
  if (!party || party.expShare === ExpShareType.EACH_TAKE) {
    return [{ accountId: killerAccountId, baseExp, jobExp }];
  }

  // Even share among online members on the same map within 30 cells
  const killerMember = party.members.find((m) => m.accountId === killerAccountId);
  if (!killerMember) return [{ accountId: killerAccountId, baseExp, jobExp }];

  const eligible = party.members.filter((m) => {
    if (!m.online) return false;
    if (m.map !== killerMap) return false;
    const dx = Math.abs(m.x - killerMember.x);
    const dy = Math.abs(m.y - killerMember.y);
    return dx <= 30 && dy <= 30;
  });

  if (eligible.length === 0) {
    return [{ accountId: killerAccountId, baseExp, jobExp }];
  }

  // Bonus: 5% extra EXP per party member
  const bonus = 1.0 + (eligible.length - 1) * 0.05;
  const sharedBase = Math.floor(baseExp * bonus / eligible.length);
  const sharedJob = Math.floor(jobExp * bonus / eligible.length);

  return eligible.map((m) => ({
    accountId: m.accountId,
    baseExp: sharedBase,
    jobExp: sharedJob,
  }));
}

/**
 * Set EXP share type
 */
export function setExpShare(partyId: number, accountId: number, type: ExpShareType): boolean {
  const party = parties.get(partyId);
  if (!party) return false;
  const member = party.members.find((m) => m.accountId === accountId);
  if (!member?.leader) return false;  // only leader can change
  party.expShare = type;
  log.info(`Party "${party.name}" EXP share set to ${type === ExpShareType.EVEN_SHARE ? 'even' : 'each'}`);
  return true;
}
