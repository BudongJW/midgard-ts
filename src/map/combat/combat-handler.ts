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
import { getEquipAtk, getEquipDef, addItem } from '../item/inventory.js';
import { createLogger } from '../../common/logger/index.js';
import type { Socket } from 'node:net';

const log = createLogger('Combat');

// Packet IDs for combat (not in main enum to keep it clean)
const ZC_NOTIFY_ACT = 0x008a;        // Damage display
const CZ_REQUEST_ACT = 0x0089;       // Attack request

interface AttackResult {
  damage: number;
  isCrit: boolean;
  killed: boolean;
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
): number {
  const mob = getMonsterByGid(targetGid);
  if (!mob) return 7;

  const def = getMobDef(mob.mobId);
  if (!def) return 7;

  // Build player stats
  const char = queryOne<{
    str: number; agi: number; vit: number;
    int: number; dex: number; luk: number;
  }>(
    'SELECT str, agi, vit, int_, dex, luk FROM characters WHERE id = ?',
    [charId],
  );

  if (!char) return 7;

  const playerStats: PlayerStats = {
    baseLv,
    str: char.str,
    agi: char.agi,
    vit: char.vit,
    int: char.int,
    dex: char.dex,
    luk: char.luk,
    equipAtk: getEquipAtk(charId),
    equipDef: getEquipDef(charId),
  };

  // HIT check
  if (!checkHit(char.dex, baseLv, def.agi, def.level)) {
    sendDamagePacket(socket, accountId, targetGid, 0, 0); // Miss
    return 7;
  }

  const damage = calcPlayerDamage(playerStats, mob);
  const killed = damageMob(targetGid, damage, accountId);

  sendDamagePacket(socket, accountId, targetGid, damage, killed ? 1 : 0);

  if (killed) {
    onMobKill(accountId, charId, charName, baseLv, mob, socket);
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
): void {
  const def = getMobDef(mob.mobId);
  if (!def) return;

  // Award EXP (affected by server rate config — use 1x for now)
  const baseExp = def.baseExp;
  const jobExp = def.jobExp;

  execute(
    'UPDATE characters SET base_exp = base_exp + ?, job_exp = job_exp + ? WHERE id = ?',
    [baseExp, jobExp, charId],
  );

  log.info(`${charName} killed ${def.name}: +${baseExp} base / +${jobExp} job EXP`);

  // Drop items
  for (const drop of def.drops) {
    const roll = Math.floor(Math.random() * 10000);
    if (roll < drop.rate) {
      const result = addItem(charId, drop.itemId, 1);
      if (result.success) {
        log.debug(`Drop: item ${drop.itemId} for ${charName}`);
      }
    }
  }

  // Check level up
  checkLevelUp(charId, charName, socket);
}

/**
 * Simplified level-up check
 * EXP table: baseExp needed = level * level * 10
 */
function checkLevelUp(charId: number, charName: string, socket: Socket): void {
  const char = queryOne<{
    base_level: number; job_level: number;
    base_exp: number; job_exp: number;
    status_point: number; skill_point: number;
    str: number; agi: number; vit: number;
    int: number; dex: number; luk: number;
  }>(
    'SELECT base_level, job_level, base_exp, job_exp, status_point, skill_point, str, agi, vit, int_, dex, luk FROM characters WHERE id = ?',
    [charId],
  );

  if (!char) return;

  let leveled = false;

  // Base level up
  const baseExpNeeded = char.base_level * char.base_level * 10;
  if (char.base_exp >= baseExpNeeded && char.base_level < 99) {
    execute(
      'UPDATE characters SET base_level = base_level + 1, base_exp = base_exp - ?, status_point = status_point + ? WHERE id = ?',
      [baseExpNeeded, 5, charId],
    );
    log.status(`${charName} base level up! -> ${char.base_level + 1}`);
    leveled = true;
  }

  // Job level up
  const jobExpNeeded = char.job_level * char.job_level * 5;
  if (char.job_exp >= jobExpNeeded && char.job_level < 50) {
    execute(
      'UPDATE characters SET job_level = job_level + 1, job_exp = job_exp - ?, skill_point = skill_point + 1 WHERE id = ?',
      [jobExpNeeded, charId],
    );
    log.status(`${charName} job level up! -> ${char.job_level + 1}`);
    leveled = true;
  }
}

/**
 * Returns the packet ID and handler size for CZ_REQUEST_ACT
 */
export const ATTACK_PACKET_ID = CZ_REQUEST_ACT;
export const ATTACK_PACKET_LEN = 7;
