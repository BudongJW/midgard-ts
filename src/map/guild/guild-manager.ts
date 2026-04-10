/**
 * MidgardTS Guild System
 * Guild creation, member management, positions, EXP tax
 * Inspired by rAthena's guild.cpp
 */

import { createLogger } from '../../common/logger/index.js';

const log = createLogger('Guild');

const MAX_GUILD_MEMBERS = 76;  // RO max (16 base + 6 per guild extension)
const MAX_POSITIONS = 20;

let nextGuildId = 1;

export enum GuildPermission {
  INVITE  = 0x01,
  EXPEL   = 0x02,
  STORAGE = 0x04,
}

export interface GuildPosition {
  idx: number;
  name: string;
  permissions: number; // bitmask of GuildPermission
  expTaxRate: number;  // 0~50 (%)
}

export interface GuildMember {
  accountId: number;
  charId: number;
  charName: string;
  positionIdx: number;
  online: boolean;
  devotion: number; // contribution EXP
}

export interface Guild {
  id: number;
  name: string;
  masterAccountId: number;
  masterName: string;
  level: number;
  exp: number;
  nextLevelExp: number;
  maxMembers: number;
  emblemId: number;      // emblem version (incremented on change)
  emblemData: Buffer;    // raw emblem bitmap
  notice: string;
  positions: GuildPosition[];
  members: GuildMember[];
  allies: number[];      // allied guild IDs
  enemies: number[];     // enemy guild IDs
}

const guilds = new Map<number, Guild>();
const memberToGuild = new Map<number, number>(); // accountId -> guildId

function defaultPositions(): GuildPosition[] {
  const positions: GuildPosition[] = [
    { idx: 0, name: 'Guild Master', permissions: 0x07, expTaxRate: 0 },
  ];
  for (let i = 1; i < MAX_POSITIONS; i++) {
    positions.push({
      idx: i,
      name: i === 1 ? 'Member' : `Position ${i}`,
      permissions: 0,
      expTaxRate: 0,
    });
  }
  return positions;
}

function calcNextLevelExp(level: number): number {
  // Simplified: 500 * level^2
  return 500 * level * level;
}

export function createGuild(
  name: string, masterAccountId: number, masterCharId: number, masterName: string,
): Guild | null {
  if (memberToGuild.has(masterAccountId)) {
    log.warn(`Account ${masterAccountId} already in a guild`);
    return null;
  }
  if (name.length === 0 || name.length > 24) {
    log.warn('Invalid guild name length');
    return null;
  }
  // Check duplicate name
  for (const [, g] of guilds) {
    if (g.name === name) {
      log.warn(`Guild name "${name}" already taken`);
      return null;
    }
  }

  const guild: Guild = {
    id: nextGuildId++,
    name,
    masterAccountId,
    masterName,
    level: 1,
    exp: 0,
    nextLevelExp: calcNextLevelExp(1),
    maxMembers: 16,
    emblemId: 0,
    emblemData: Buffer.alloc(0),
    notice: '',
    positions: defaultPositions(),
    members: [{
      accountId: masterAccountId,
      charId: masterCharId,
      charName: masterName,
      positionIdx: 0, // Guild Master
      online: true,
      devotion: 0,
    }],
    allies: [],
    enemies: [],
  };

  guilds.set(guild.id, guild);
  memberToGuild.set(masterAccountId, guild.id);
  log.info(`Guild "${name}" created by ${masterName} (id=${guild.id})`);
  return guild;
}

export function addGuildMember(
  guildId: number, accountId: number, charId: number, charName: string,
): boolean {
  const guild = guilds.get(guildId);
  if (!guild) return false;
  if (memberToGuild.has(accountId)) return false;
  if (guild.members.length >= guild.maxMembers) {
    log.warn(`Guild "${guild.name}" is full`);
    return false;
  }

  guild.members.push({
    accountId, charId, charName,
    positionIdx: 1, // default Member position
    online: true,
    devotion: 0,
  });
  memberToGuild.set(accountId, guildId);
  log.info(`${charName} joined guild "${guild.name}"`);
  return true;
}

export function removeGuildMember(accountId: number): boolean {
  const guildId = memberToGuild.get(accountId);
  if (guildId === undefined) return false;

  const guild = guilds.get(guildId);
  if (!guild) { memberToGuild.delete(accountId); return false; }

  const idx = guild.members.findIndex((m) => m.accountId === accountId);
  if (idx < 0) { memberToGuild.delete(accountId); return false; }

  const member = guild.members[idx];

  // Guild master leaving -> disband
  if (member.positionIdx === 0) {
    for (const m of guild.members) {
      memberToGuild.delete(m.accountId);
    }
    guilds.delete(guildId);
    log.info(`Guild "${guild.name}" disbanded (master left)`);
    return true;
  }

  guild.members.splice(idx, 1);
  memberToGuild.delete(accountId);
  log.info(`${member.charName} left guild "${guild.name}"`);
  return true;
}

export function getGuildByAccount(accountId: number): Guild | undefined {
  const guildId = memberToGuild.get(accountId);
  if (guildId === undefined) return undefined;
  return guilds.get(guildId);
}

export function getGuildById(id: number): Guild | undefined {
  return guilds.get(id);
}

/**
 * Donate EXP to guild (taxed from mob kills)
 */
export function donateGuildExp(accountId: number, baseExp: number): number {
  const guild = getGuildByAccount(accountId);
  if (!guild) return 0;

  const member = guild.members.find((m) => m.accountId === accountId);
  if (!member) return 0;

  const pos = guild.positions[member.positionIdx];
  if (!pos || pos.expTaxRate <= 0) return 0;

  const taxed = Math.floor(baseExp * pos.expTaxRate / 100);
  guild.exp += taxed;
  member.devotion += taxed;

  // Guild level up check
  while (guild.exp >= guild.nextLevelExp && guild.level < 50) {
    guild.exp -= guild.nextLevelExp;
    guild.level++;
    guild.maxMembers = Math.min(MAX_GUILD_MEMBERS, 16 + (guild.level - 1) * 2);
    guild.nextLevelExp = calcNextLevelExp(guild.level);
    log.status(`Guild "${guild.name}" leveled up to ${guild.level}! Max members: ${guild.maxMembers}`);
  }

  return taxed;
}

export function setGuildNotice(accountId: number, notice: string): boolean {
  const guild = getGuildByAccount(accountId);
  if (!guild) return false;
  const member = guild.members.find((m) => m.accountId === accountId);
  if (!member || member.positionIdx !== 0) return false; // master only
  guild.notice = notice.substring(0, 120);
  log.info(`Guild "${guild.name}" notice updated`);
  return true;
}

export function setPositionInfo(
  guildId: number, accountId: number, posIdx: number, name: string, permissions: number, expTaxRate: number,
): boolean {
  const guild = guilds.get(guildId);
  if (!guild) return false;
  const member = guild.members.find((m) => m.accountId === accountId);
  if (!member || member.positionIdx !== 0) return false; // master only

  if (posIdx < 0 || posIdx >= guild.positions.length) return false;
  if (posIdx === 0) return false; // can't edit master position

  guild.positions[posIdx].name = name.substring(0, 24);
  guild.positions[posIdx].permissions = permissions;
  guild.positions[posIdx].expTaxRate = Math.min(50, Math.max(0, expTaxRate));
  return true;
}

export function setMemberPosition(
  guildId: number, masterAccountId: number, targetAccountId: number, posIdx: number,
): boolean {
  const guild = guilds.get(guildId);
  if (!guild) return false;
  const master = guild.members.find((m) => m.accountId === masterAccountId);
  if (!master || master.positionIdx !== 0) return false;

  const target = guild.members.find((m) => m.accountId === targetAccountId);
  if (!target) return false;
  if (posIdx < 0 || posIdx >= guild.positions.length || posIdx === 0) return false;

  target.positionIdx = posIdx;
  log.info(`${target.charName} assigned position "${guild.positions[posIdx].name}" in guild "${guild.name}"`);
  return true;
}

export function addAlliance(guildId1: number, guildId2: number): boolean {
  const g1 = guilds.get(guildId1);
  const g2 = guilds.get(guildId2);
  if (!g1 || !g2) return false;
  if (g1.allies.includes(guildId2)) return false;
  if (g1.allies.length >= 3 || g2.allies.length >= 3) return false; // RO max 3 allies

  g1.allies.push(guildId2);
  g2.allies.push(guildId1);
  // Remove from enemies if present
  g1.enemies = g1.enemies.filter((id) => id !== guildId2);
  g2.enemies = g2.enemies.filter((id) => id !== guildId1);
  log.info(`Alliance formed: "${g1.name}" <-> "${g2.name}"`);
  return true;
}

export function addEnemy(guildId1: number, guildId2: number): boolean {
  const g1 = guilds.get(guildId1);
  const g2 = guilds.get(guildId2);
  if (!g1 || !g2) return false;
  if (g1.enemies.includes(guildId2)) return false;
  if (g1.enemies.length >= 3) return false; // max 3 enemies

  g1.enemies.push(guildId2);
  // Remove from allies if present
  g1.allies = g1.allies.filter((id) => id !== guildId2);
  g2.allies = g2.allies.filter((id) => id !== guildId1);
  log.info(`Guild "${g1.name}" declared "${g2.name}" as enemy`);
  return true;
}

export function setGuildMemberOnline(accountId: number, online: boolean): void {
  const guild = getGuildByAccount(accountId);
  if (!guild) return;
  const member = guild.members.find((m) => m.accountId === accountId);
  if (member) member.online = online;
}

export function getAllGuilds(): Guild[] {
  return Array.from(guilds.values());
}
