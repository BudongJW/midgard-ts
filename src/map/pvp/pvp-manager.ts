/**
 * MidgardTS PvP & War of Emperium System
 * PvP map flags, rankings, WoE castle ownership
 * Inspired by rAthena's pc.cpp (PvP) and guild.cpp (WoE)
 */

import { createLogger } from '../../common/logger/index.js';
import { getGuildById, type Guild } from '../guild/guild-manager.js';

const log = createLogger('PvP');

// ======= PvP System =======

export enum PvpMode {
  OFF = 0,
  ON = 1,        // Free-for-all PvP
  GVG = 2,       // Guild vs Guild
  BATTLEGROUND = 3,
}

export interface PvpMapConfig {
  map: string;
  mode: PvpMode;
  noItemUse: boolean;
  noSkillUse: boolean;
  nightmareMode: boolean; // drop items on death
}

export interface PvpScore {
  accountId: number;
  charName: string;
  kills: number;
  deaths: number;
}

const pvpMaps = new Map<string, PvpMapConfig>();
const pvpScores = new Map<string, Map<number, PvpScore>>(); // map -> accountId -> score

export function setPvpMap(config: PvpMapConfig): void {
  pvpMaps.set(config.map, config);
  if (!pvpScores.has(config.map)) {
    pvpScores.set(config.map, new Map());
  }
  log.info(`PvP ${PvpMode[config.mode]} enabled on ${config.map}`);
}

export function getPvpConfig(map: string): PvpMapConfig | undefined {
  return pvpMaps.get(map);
}

export function isPvpMap(map: string): boolean {
  const cfg = pvpMaps.get(map);
  return cfg !== undefined && cfg.mode !== PvpMode.OFF;
}

export function isGvgMap(map: string): boolean {
  const cfg = pvpMaps.get(map);
  return cfg !== undefined && cfg.mode === PvpMode.GVG;
}

/**
 * Check if two players can attack each other
 */
export function canAttackPlayer(
  map: string,
  attackerAccountId: number, attackerGuildId: number | undefined,
  targetAccountId: number, targetGuildId: number | undefined,
): boolean {
  const cfg = pvpMaps.get(map);
  if (!cfg || cfg.mode === PvpMode.OFF) return false;

  if (cfg.mode === PvpMode.ON || cfg.mode === PvpMode.BATTLEGROUND) {
    return attackerAccountId !== targetAccountId; // can attack anyone except self
  }

  if (cfg.mode === PvpMode.GVG) {
    // Can't attack same guild or allied guild
    if (attackerGuildId === undefined || targetGuildId === undefined) return false;
    if (attackerGuildId === targetGuildId) return false;

    const attackerGuild = getGuildById(attackerGuildId);
    if (attackerGuild?.allies.includes(targetGuildId)) return false;

    return true;
  }

  return false;
}

/**
 * Record a PvP kill
 */
export function recordPvpKill(map: string, killerAccountId: number, killerName: string, victimAccountId: number, victimName: string): void {
  const scores = pvpScores.get(map);
  if (!scores) return;

  // Killer
  let ks = scores.get(killerAccountId);
  if (!ks) { ks = { accountId: killerAccountId, charName: killerName, kills: 0, deaths: 0 }; scores.set(killerAccountId, ks); }
  ks.kills++;

  // Victim
  let vs = scores.get(victimAccountId);
  if (!vs) { vs = { accountId: victimAccountId, charName: victimName, kills: 0, deaths: 0 }; scores.set(victimAccountId, vs); }
  vs.deaths++;

  log.info(`[PvP] ${killerName} killed ${victimName} on ${map}`);
}

/**
 * Get PvP rankings for a map, sorted by kills desc
 */
export function getPvpRanking(map: string): PvpScore[] {
  const scores = pvpScores.get(map);
  if (!scores) return [];
  return Array.from(scores.values()).sort((a, b) => b.kills - a.kills);
}

export function getPlayerPvpScore(map: string, accountId: number): PvpScore | undefined {
  return pvpScores.get(map)?.get(accountId);
}

// ======= War of Emperium =======

export interface WoeCastle {
  id: string;           // e.g. 'payg_cas01'
  name: string;         // e.g. 'Neuschwanstein'
  map: string;
  ownerGuildId: number | null;
  emperiumHp: number;
  maxEmperiumHp: number;
  treasureBoxes: number; // 0~5, depends on guild investment
  defense: number;       // castle defense level 0~20
  economy: number;       // castle economy level 0~20
}

const castles = new Map<string, WoeCastle>();
let woeActive = false;

function regCastle(c: WoeCastle): void {
  castles.set(c.id, c);
}

// Prontera castles (Valkyrie Realm)
regCastle({ id: 'prtg_cas01', name: 'Neuschwanstein', map: 'prtg_cas01', ownerGuildId: null, emperiumHp: 30000, maxEmperiumHp: 30000, treasureBoxes: 0, defense: 0, economy: 0 });
regCastle({ id: 'prtg_cas02', name: 'Hohenschwangau', map: 'prtg_cas02', ownerGuildId: null, emperiumHp: 30000, maxEmperiumHp: 30000, treasureBoxes: 0, defense: 0, economy: 0 });
regCastle({ id: 'prtg_cas03', name: 'Nuernberg', map: 'prtg_cas03', ownerGuildId: null, emperiumHp: 30000, maxEmperiumHp: 30000, treasureBoxes: 0, defense: 0, economy: 0 });
regCastle({ id: 'prtg_cas04', name: 'Wuerzburg', map: 'prtg_cas04', ownerGuildId: null, emperiumHp: 30000, maxEmperiumHp: 30000, treasureBoxes: 0, defense: 0, economy: 0 });
regCastle({ id: 'prtg_cas05', name: 'Rothenburg', map: 'prtg_cas05', ownerGuildId: null, emperiumHp: 30000, maxEmperiumHp: 30000, treasureBoxes: 0, defense: 0, economy: 0 });

// Payon castles (Greenwood Lake)
regCastle({ id: 'payg_cas01', name: 'Bright Arbor', map: 'payg_cas01', ownerGuildId: null, emperiumHp: 30000, maxEmperiumHp: 30000, treasureBoxes: 0, defense: 0, economy: 0 });
regCastle({ id: 'payg_cas02', name: 'Scarlet Palace', map: 'payg_cas02', ownerGuildId: null, emperiumHp: 30000, maxEmperiumHp: 30000, treasureBoxes: 0, defense: 0, economy: 0 });

export function isWoeActive(): boolean {
  return woeActive;
}

export function startWoe(): void {
  woeActive = true;
  // Reset emperium HP
  for (const [, castle] of castles) {
    castle.emperiumHp = castle.maxEmperiumHp;
  }
  log.status('=== War of Emperium has begun! ===');
}

export function endWoe(): void {
  woeActive = false;
  log.status('=== War of Emperium has ended! ===');
  for (const [, castle] of castles) {
    if (castle.ownerGuildId !== null) {
      const guild = getGuildById(castle.ownerGuildId);
      log.info(`Castle "${castle.name}" owned by guild "${guild?.name ?? 'unknown'}"`);
    }
  }
}

export function getCastle(id: string): WoeCastle | undefined {
  return castles.get(id);
}

export function getAllCastles(): WoeCastle[] {
  return Array.from(castles.values());
}

/**
 * Damage the emperium in a castle
 * Returns true if emperium broke (castle captured)
 */
export function damageEmperium(castleId: string, damage: number, attackerGuildId: number): boolean {
  if (!woeActive) return false;

  const castle = castles.get(castleId);
  if (!castle) return false;
  if (castle.ownerGuildId === attackerGuildId) return false; // can't break own emperium

  castle.emperiumHp -= damage;

  if (castle.emperiumHp <= 0) {
    castle.emperiumHp = 0;
    const prevOwner = castle.ownerGuildId;
    castle.ownerGuildId = attackerGuildId;
    castle.emperiumHp = castle.maxEmperiumHp; // reset for new owner

    const attackerGuild = getGuildById(attackerGuildId);
    const prevGuild = prevOwner !== null ? getGuildById(prevOwner) : undefined;
    log.status(`Castle "${castle.name}" captured by "${attackerGuild?.name}" (from "${prevGuild?.name ?? 'unoccupied'}")`);
    return true;
  }

  return false;
}

/**
 * Invest in castle defense or economy
 */
export function investCastle(castleId: string, accountId: number, type: 'defense' | 'economy'): boolean {
  const castle = castles.get(castleId);
  if (!castle || castle.ownerGuildId === null) return false;

  // Only owning guild master can invest (simplified)
  const guild = getGuildById(castle.ownerGuildId);
  if (!guild || guild.masterAccountId !== accountId) return false;

  if (type === 'defense' && castle.defense < 20) {
    castle.defense++;
    castle.maxEmperiumHp = 30000 + castle.defense * 2000;
    log.info(`Castle "${castle.name}" defense -> ${castle.defense}`);
    return true;
  }
  if (type === 'economy' && castle.economy < 20) {
    castle.economy++;
    castle.treasureBoxes = Math.min(5, Math.floor(castle.economy / 4));
    log.info(`Castle "${castle.name}" economy -> ${castle.economy}, treasure boxes: ${castle.treasureBoxes}`);
    return true;
  }
  return false;
}

// Initialize default PvP maps
setPvpMap({ map: 'pvp_y_1-1', mode: PvpMode.ON, noItemUse: false, noSkillUse: false, nightmareMode: false });
setPvpMap({ map: 'pvp_y_1-2', mode: PvpMode.ON, noItemUse: false, noSkillUse: false, nightmareMode: false });
setPvpMap({ map: 'pvp_y_1-3', mode: PvpMode.ON, noItemUse: true, noSkillUse: false, nightmareMode: false });
setPvpMap({ map: 'pvp_n_1-1', mode: PvpMode.ON, noItemUse: false, noSkillUse: false, nightmareMode: true });
