/**
 * MidgardTS Skill Handler
 * Processes skill use packets, validates SP/cooldowns, applies effects
 * Inspired by rAthena's skill.cpp
 */

import { PacketWriter } from '../../common/packet/index.js';
import { execute, queryOne } from '../../common/database/index.js';
import { getSkillDef, SkillTarget, type SkillDef } from './skill-db.js';
import { getEquipAtk } from '../item/inventory.js';
import { damageMob, getMonsterByGid } from '../monster/mob-spawner.js';
import { getMobDef } from '../monster/mob-db.js';
import { createLogger } from '../../common/logger/index.js';
import type { Socket } from 'node:net';

const log = createLogger('Skill');

// Skill-related packet IDs
const CZ_USE_SKILL       = 0x0113;  // Client -> Map: Use skill on target
const CZ_USE_SKILL_TOGROUND = 0x0116; // Client -> Map: Use skill on ground
const ZC_NOTIFY_SKILL     = 0x01de;  // Map -> Client: Skill visual effect
const ZC_USE_SKILL        = 0x011a;  // Map -> Client: Skill damage display
const ZC_SKILL_ENTRY      = 0x011f;  // Map -> Client: Ground skill unit

/** Per-account cooldown tracker */
const cooldowns = new Map<number, Map<number, number>>(); // accountId -> skillId -> readyAt

function getCooldownMap(accountId: number): Map<number, number> {
  let cd = cooldowns.get(accountId);
  if (!cd) { cd = new Map(); cooldowns.set(accountId, cd); }
  return cd;
}

interface SkillUseResult {
  success: boolean;
  damage: number;
  killed: boolean;
}

/**
 * Handle CZ_USE_SKILL (0x0113): Skill on target
 * Packet: [header 2][skillLv 2][skillId 2][targetGid 4] = 10 bytes
 */
export function handleUseSkill(
  accountId: number, charId: number, baseLv: number, buffer: Buffer, socket: Socket,
): number {
  if (buffer.length < 10) return 0;

  const skillLv = buffer.readUInt16LE(2);
  const skillId = buffer.readUInt16LE(4);
  const targetGid = buffer.readUInt32LE(6);

  const def = getSkillDef(skillId);
  if (!def) {
    log.warn(`Unknown skill ${skillId}`);
    return 10;
  }

  const lv = Math.min(skillLv, def.maxLv);
  const lvIdx = lv - 1;

  // Cooldown check
  const now = Date.now();
  const cdMap = getCooldownMap(accountId);
  const readyAt = cdMap.get(skillId) ?? 0;
  if (now < readyAt) {
    log.debug(`Skill ${def.name} still on cooldown for account ${accountId}`);
    return 10;
  }

  // SP check
  const char = queryOne<{ sp: number; max_sp: number; hp: number; max_hp: number; int: number; str: number; dex: number }>(
    'SELECT sp, max_sp, hp, max_hp, int_, str, dex FROM characters WHERE id = ?',
    [charId],
  );
  if (!char) return 10;

  const spCost = def.spCost[lvIdx] ?? def.spCost[0];
  if (char.sp < spCost) {
    log.debug(`Not enough SP for ${def.name} (need ${spCost}, have ${char.sp})`);
    return 10;
  }

  // Consume SP
  execute('UPDATE characters SET sp = sp - ? WHERE id = ?', [spCost, charId]);

  // Set cooldown
  const cd = def.cooldown[lvIdx] ?? 0;
  if (cd > 0) cdMap.set(skillId, now + cd);

  // Process skill effect
  if (def.target === SkillTarget.SELF || def.target === SkillTarget.FRIEND) {
    handleSupportSkill(def, lv, charId, char, socket);
  } else if (def.target === SkillTarget.ENEMY) {
    handleOffensiveSkill(def, lv, accountId, charId, baseLv, char, targetGid, socket);
  }

  log.info(`${def.name} Lv${lv} used by char ${charId} on target ${targetGid}`);
  return 10;
}

/**
 * Handle CZ_USE_SKILL_TOGROUND (0x0116): Skill on ground
 * Packet: [header 2][skillLv 2][skillId 2][x 2][y 2] = 10 bytes
 */
export function handleUseSkillGround(
  accountId: number, charId: number, baseLv: number, buffer: Buffer, socket: Socket,
): number {
  if (buffer.length < 10) return 0;

  const skillLv = buffer.readUInt16LE(2);
  const skillId = buffer.readUInt16LE(4);
  const x = buffer.readUInt16LE(6);
  const y = buffer.readUInt16LE(8);

  const def = getSkillDef(skillId);
  if (!def) return 10;

  // Same SP/cooldown logic as targeted skill
  const lv = Math.min(skillLv, def.maxLv);
  const lvIdx = lv - 1;
  const now = Date.now();
  const cdMap = getCooldownMap(accountId);
  if (now < (cdMap.get(skillId) ?? 0)) return 10;

  const char = queryOne<{ sp: number }>(
    'SELECT sp FROM characters WHERE id = ?', [charId],
  );
  if (!char) return 10;

  const spCost = def.spCost[lvIdx] ?? def.spCost[0];
  if (char.sp < spCost) return 10;

  execute('UPDATE characters SET sp = sp - ? WHERE id = ?', [spCost, charId]);
  const cd = def.cooldown[lvIdx] ?? 0;
  if (cd > 0) cdMap.set(skillId, now + cd);

  // Send ground skill visual
  const writer = new PacketWriter(18);
  writer.writeUInt16LE(ZC_SKILL_ENTRY);
  writer.writeUInt32LE(skillId);
  writer.writeUInt32LE(accountId);
  writer.writeUInt16LE(x);
  writer.writeUInt16LE(y);
  writer.writeUInt8(1);  // visible
  writer.writeUInt8(lv);
  socket.write(writer.toBuffer());

  log.info(`${def.name} Lv${lv} used on ground (${x},${y})`);
  return 10;
}

function handleSupportSkill(
  def: SkillDef, lv: number, charId: number,
  char: { hp: number; max_hp: number; int: number; sp: number; max_sp: number },
  socket: Socket,
): void {
  if (def.id === 1) {
    // First Aid: heal 5 HP
    execute('UPDATE characters SET hp = MIN(max_hp, hp + 5) WHERE id = ?', [charId]);
    log.debug(`First Aid: +5 HP for char ${charId}`);
  } else if (def.id === 19) {
    // Heal: HP recovery = (BaseLv + INT) * skillLv * 2
    const healAmount = (char.int + 10) * lv * 2;
    execute('UPDATE characters SET hp = MIN(max_hp, hp + ?) WHERE id = ?', [healAmount, charId]);
    log.debug(`Heal Lv${lv}: +${healAmount} HP for char ${charId}`);
  }
}

function handleOffensiveSkill(
  def: SkillDef, lv: number,
  accountId: number, charId: number, baseLv: number,
  char: { str: number; dex: number; int: number },
  targetGid: number, socket: Socket,
): void {
  const mob = getMonsterByGid(targetGid);
  if (!mob) return;

  const mobDef = getMobDef(mob.mobId);
  if (!mobDef) return;

  const lvIdx = lv - 1;
  const pct = def.damagePercent[lvIdx] ?? 100;

  // Base MATK or ATK depending on skill element
  let baseAtk: number;
  if (def.element !== 0) {
    // Magic: MATK = INT^2/16 + INT
    baseAtk = Math.floor(char.int * char.int / 16) + char.int;
  } else {
    baseAtk = char.str + Math.floor(char.dex / 5) + getEquipAtk(charId);
  }

  let damage = Math.floor(baseAtk * pct / 100) * def.hitCount;
  damage = Math.max(1, damage - (def.element !== 0 ? mobDef.mdef : mobDef.def));

  const killed = damageMob(targetGid, damage, accountId);

  // Send skill damage packet
  const writer = new PacketWriter(16);
  writer.writeUInt16LE(ZC_USE_SKILL);
  writer.writeUInt16LE(def.id);
  writer.writeUInt32LE(accountId);
  writer.writeUInt32LE(targetGid);
  writer.writeUInt16LE(1);  // result (1=success)
  writer.writeUInt16LE(Math.min(damage, 0xFFFF));
  socket.write(writer.toBuffer());

  if (killed) {
    log.info(`Monster ${targetGid} killed by skill ${def.name}`);
  }
}

export function clearCooldowns(accountId: number): void {
  cooldowns.delete(accountId);
}

export const SKILL_PACKET_ID = CZ_USE_SKILL;
export const SKILL_GROUND_PACKET_ID = CZ_USE_SKILL_TOGROUND;
