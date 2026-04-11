/**
 * MidgardTS Combat Handler
 * Processes attack packets, calculates damage, distributes EXP/drops
 * Inspired by rAthena's battle.cpp + pc.cpp
 */

import { PacketWriter, PacketId } from '../../common/packet/index.js';
import { execute, queryOne } from '../../common/database/index.js';
import { calcPlayerDamage, calcMobDamage, checkHit, type PlayerStats } from './damage-calc.js';
import { damageMob, getMonsterByGid, type MobInstance } from '../monster/mob-spawner.js';
import { getMobDef } from '../monster/mob-db.js';
import { addItem } from '../item/inventory.js';
import { createLogger } from '../../common/logger/index.js';
import type { Socket } from 'node:net';

const log = createLogger('Combat');

// Packet IDs for combat (not in main enum to keep it clean)
const ZC_NOTIFY_ACT = 0x008a;        // Damage display
const CZ_REQUEST_ACT = 0x0089;       // Attack request

export interface ExpDropRates {
  baseExpRate: number;  // 100 = 1x
  jobExpRate: number;
  dropRate: number;
}

/**
 * Handle CZ_REQUEST_ACT (0x0089): Player attacks a target
 * Packet: [header 2][targetGid 4][action 1] = 7 bytes
 * action: 0=once, 7=continuous
 */
export function handleAttackRequest(
  accountId: number,
  charId: number,
  charName: string,
  baseLv: number,
  targetGid: number,
  action: number,
  socket: Socket,
  rates: ExpDropRates = { baseExpRate: 100, jobExpRate: 100, dropRate: 100 },
  cachedStats?: Partial<PlayerStats>,
): number {
  const mob = getMonsterByGid(targetGid);
  if (!mob) return 7;

  const def = getMobDef(mob.mobId);
  if (!def) return 7;

  // Use cached stats from PlayerState (populated on map entry) to avoid per-attack DB queries
  const playerStats: PlayerStats = {
    baseLv,
    str: cachedStats?.str ?? 1,
    agi: cachedStats?.agi ?? 1,
    vit: cachedStats?.vit ?? 1,
    int: cachedStats?.int ?? 1,
    dex: cachedStats?.dex ?? 1,
    luk: cachedStats?.luk ?? 1,
    equipAtk: cachedStats?.equipAtk ?? 0,
    equipDef: cachedStats?.equipDef ?? 0,
  };

  // HIT check
  if (!checkHit(playerStats.dex, baseLv, def.agi, def.level)) {
    sendDamagePacket(socket, accountId, targetGid, 0, 0); // Miss
    return 7;
  }

  const damage = calcPlayerDamage(playerStats, mob);
  const killed = damageMob(targetGid, damage, accountId);

  sendDamagePacket(socket, accountId, targetGid, damage, killed ? 1 : 0);

  if (killed) {
    onMobKill(accountId, charId, charName, baseLv, mob, socket, rates);
  }

  return 7;
}

function sendDamagePacket(socket: Socket, srcGid: number, dstGid: number, damage: number, type: number): void {
  // ZC_NOTIFY_ACT: [header 2][src 4][dst 4][tick 4][srcDelay 4][dstDelay 4][dmg 2][div 2][type 1][padding 2]
  const writer = new PacketWriter(29);
  writer.writeUInt16LE(ZC_NOTIFY_ACT);
  writer.writeUInt32LE(srcGid);
  writer.writeUInt32LE(dstGid);
  writer.writeUInt32LE(Date.now() & 0xFFFFFFFF);
  writer.writeUInt32LE(480);  // src delay (amotion)
  writer.writeUInt32LE(480);  // dst delay (dmotion)
  writer.writeUInt16LE(Math.min(damage, 0xFFFF));
  writer.writeUInt16LE(1);    // number of hits
  writer.writeUInt8(type);    // 0=normal, 1=pickup(death)
  writer.writeUInt16LE(0);    // padding
  socket.write(writer.toBuffer());
}

function onMobKill(
  accountId: number, charId: number, charName: string,
  baseLv: number, mob: MobInstance, socket: Socket,
  rates: ExpDropRates,
): void {
  const def = getMobDef(mob.mobId);
  if (!def) return;

  // Apply server EXP rates (100 = 1x)
  const baseExp = Math.floor(def.baseExp * rates.baseExpRate / 100);
  const jobExp = Math.floor(def.jobExp * rates.jobExpRate / 100);

  execute(
    'UPDATE characters SET base_exp = base_exp + ?, job_exp = job_exp + ? WHERE id = ?',
    [baseExp, jobExp, charId],
  );

  log.info(`${charName} killed ${def.name}: +${baseExp} base / +${jobExp} job EXP`);

  // Drop items — apply server drop rate
  for (const drop of def.drops) {
    const effectiveRate = Math.floor(drop.rate * rates.dropRate / 100);
    const roll = Math.floor(Math.random() * 10000);
    if (roll < effectiveRate) {
      const result = addItem(charId, drop.itemId, 1);
      if (result.success) {
        log.debug(`Drop: item ${drop.itemId} for ${charName}`);
      }
    }
  }

  // Check level up
  checkLevelUp(charId, charName, socket);
}

// ZC_STATUS_CHANGE (0x00bc): notify client of a single stat change
// field: 0x0020=BaseLevel, 0x0021=JobLevel, 0x0028=StatusPoint, 0x002f=SkillPoint
const ZC_STATUS_CHANGE = 0x00bc;

function sendStatusChange(socket: Socket, field: number, value: number): void {
  const writer = new PacketWriter(8);
  writer.writeUInt16LE(ZC_STATUS_CHANGE);
  writer.writeUInt16LE(field);
  writer.writeUInt32LE(value);
  socket.write(writer.toBuffer());
}

/**
 * Level-up check — loops until EXP is insufficient to level up further.
 * EXP table: baseExpNeeded = level * level * 10
 * Sends ZC_STATUS_CHANGE packets to notify the client.
 */
function checkLevelUp(charId: number, charName: string, socket: Socket): void {
  const char = queryOne<{
    base_level: number; job_level: number;
    base_exp: number; job_exp: number;
    status_point: number; skill_point: number;
  }>(
    'SELECT base_level, job_level, base_exp, job_exp, status_point, skill_point FROM characters WHERE id = ?',
    [charId],
  );

  if (!char) return;

  let baseLevel = char.base_level;
  let jobLevel = char.job_level;
  let baseExp = char.base_exp;
  let jobExp = char.job_exp;
  let statusPoint = char.status_point;
  let skillPoint = char.skill_point;
  let baseLeveled = false;
  let jobLeveled = false;

  // Base level up — loop to handle multiple levels from one kill
  while (baseLevel < 99) {
    const needed = baseLevel * baseLevel * 10;
    if (baseExp < needed) break;
    baseExp -= needed;
    baseLevel++;
    statusPoint += 5;
    baseLeveled = true;
    log.status(`${charName} base level up! -> ${baseLevel}`);
  }

  // Job level up — loop
  while (jobLevel < 50) {
    const needed = jobLevel * jobLevel * 5;
    if (jobExp < needed) break;
    jobExp -= needed;
    jobLevel++;
    skillPoint++;
    jobLeveled = true;
    log.status(`${charName} job level up! -> ${jobLevel}`);
  }

  if (!baseLeveled && !jobLeveled) return;

  execute(
    `UPDATE characters SET
      base_level = ?, job_level = ?,
      base_exp = ?, job_exp = ?,
      status_point = ?, skill_point = ?
     WHERE id = ?`,
    [baseLevel, jobLevel, baseExp, jobExp, statusPoint, skillPoint, charId],
  );

  // Notify client of updated values
  if (baseLeveled) {
    sendStatusChange(socket, 0x0020, baseLevel);       // BaseLevel
    sendStatusChange(socket, 0x0028, statusPoint);     // StatusPoint
  }
  if (jobLeveled) {
    sendStatusChange(socket, 0x0021, jobLevel);        // JobLevel
    sendStatusChange(socket, 0x002f, skillPoint);      // SkillPoint
  }
}

/**
 * Returns the packet ID and handler size for CZ_REQUEST_ACT
 */
export const ATTACK_PACKET_ID = CZ_REQUEST_ACT;
export const ATTACK_PACKET_LEN = 7;
