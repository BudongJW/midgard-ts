/**
 * MidgardTS Monster Spawner & AI
 * Handles monster instantiation, simple AI (idle/chase/attack), and respawn timers
 * Inspired by rAthena's mob.cpp
 */

import { getMobDef, getMapSpawns, type MobDef } from './mob-db.js';
import { calcMobDamage } from '../combat/damage-calc.js';
import { PacketWriter } from '../../common/packet/index.js';
import { createLogger } from '../../common/logger/index.js';

// Callback types passed from MapServer to avoid circular dependencies
export type GetPlayerPos = (accountId: number) => { x: number; y: number } | undefined;
export type DamagePlayerFn = (accountId: number, damage: number) => void;
export type BroadcastFn = (mapName: string, data: Buffer) => void;

const log = createLogger('MobSpawn');

let nextMobGid = 200000;

export enum MobAiState {
  IDLE = 0,
  CHASE = 1,
  ATTACK = 2,
  DEAD = 3,
}

export interface MobInstance {
  gid: number;         // unique game ID for this instance
  mobId: number;       // reference to MobDef
  map: string;
  x: number;
  y: number;
  dir: number;
  hp: number;
  maxHp: number;
  state: MobAiState;
  targetAccountId: number | null;
  lastMoveTime: number;
  lastAttackTime: number;
  respawnMs: number;
  deathTime: number;   // timestamp when killed (for respawn)
}

/** All alive monsters grouped by map */
const mapMobs = new Map<string, MobInstance[]>();

/** Dead monsters waiting to respawn */
const deadMobs: MobInstance[] = [];

function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Initialize all monster spawns for a map
 */
export function initMapSpawns(mapName: string): void {
  const spawnDef = getMapSpawns(mapName);
  if (!spawnDef) return;

  const mobs: MobInstance[] = [];
  for (const spawn of spawnDef.spawns) {
    const def = getMobDef(spawn.mobId);
    if (!def) continue;
    for (let i = 0; i < spawn.count; i++) {
      mobs.push(createMobInstance(def, mapName, spawn.respawnMs));
    }
  }
  mapMobs.set(mapName, mobs);
  log.info(`Spawned ${mobs.length} monsters on ${mapName}`);
}

function createMobInstance(def: MobDef, map: string, respawnMs: number): MobInstance {
  return {
    gid: nextMobGid++,
    mobId: def.id,
    map,
    x: randomRange(20, 280),   // random position (simplified, no walkability check)
    y: randomRange(20, 280),
    dir: randomRange(0, 7),
    hp: def.hp,
    maxHp: def.hp,
    state: MobAiState.IDLE,
    targetAccountId: null,
    lastMoveTime: Date.now(),
    lastAttackTime: 0,
    respawnMs,
    deathTime: 0,
  };
}

/**
 * Get all alive monsters on a map
 */
export function getMonstersOnMap(mapName: string): MobInstance[] {
  return mapMobs.get(mapName) ?? [];
}

/**
 * Get a specific monster by GID
 */
export function getMonsterByGid(gid: number): MobInstance | undefined {
  for (const [, mobs] of mapMobs) {
    const mob = mobs.find((m) => m.gid === gid);
    if (mob) return mob;
  }
  return undefined;
}

/**
 * Apply damage to a monster, returns true if it died
 */
export function damageMob(gid: number, damage: number, attackerAccountId: number): boolean {
  const mob = getMonsterByGid(gid);
  if (!mob || mob.state === MobAiState.DEAD) return false;

  mob.hp -= damage;
  mob.targetAccountId = attackerAccountId;

  if (mob.hp <= 0) {
    mob.hp = 0;
    mob.state = MobAiState.DEAD;
    mob.deathTime = Date.now();

    // Move to dead queue for respawn
    const mapMobList = mapMobs.get(mob.map);
    if (mapMobList) {
      const idx = mapMobList.indexOf(mob);
      if (idx >= 0) mapMobList.splice(idx, 1);
    }
    deadMobs.push(mob);

    log.debug(`Monster ${mob.gid} (${getMobDef(mob.mobId)?.name}) killed`);
    return true;
  }

  // Aggro: switch to chase/attack
  if (mob.state === MobAiState.IDLE) {
    mob.state = MobAiState.CHASE;
  }
  return false;
}

const ATTACK_RANGE = 3;  // cells
const CHASE_RANGE = 20; // cells, leash distance

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)); // Chebyshev
}

// ZC_NOTIFY_ACT: damage packet for mob->player hit
const ZC_NOTIFY_ACT = 0x008a;

function buildDamagePacket(srcGid: number, dstGid: number, damage: number): Buffer {
  const w = new PacketWriter(29);
  w.writeUInt16LE(ZC_NOTIFY_ACT);
  w.writeUInt32LE(srcGid);
  w.writeUInt32LE(dstGid);
  w.writeUInt32LE(0);
  w.writeUInt32LE(480);
  w.writeUInt32LE(480);
  w.writeUInt16LE(Math.min(damage, 0xFFFF));
  w.writeUInt16LE(1);
  w.writeUInt8(0);
  w.writeUInt16LE(0);
  return w.toBuffer();
}

// ZC_NOTIFY_MOVE (0x0086): mob movement packet
const ZC_NOTIFY_MOVE = 0x0086;

function buildMobMovePacket(mob: MobInstance, toX: number, toY: number, now: number): Buffer {
  // [header 2][gid 4][tick 4][from_pos 3][to_pos 3][speed 2] = 18
  const w = new PacketWriter(18);
  w.writeUInt16LE(ZC_NOTIFY_MOVE);
  w.writeUInt32LE(mob.gid);
  w.writeUInt32LE(now & 0xFFFFFFFF);
  // from pos
  w.writeUInt8((mob.x >> 2) & 0xFF);
  w.writeUInt8((((mob.x & 3) << 6) | ((mob.y >> 4) & 0x3F)) & 0xFF);
  w.writeUInt8((((mob.y & 0xF) << 4) | (mob.dir & 0xF)) & 0xFF);
  // to pos (same encoding, dir=0)
  w.writeUInt8((toX >> 2) & 0xFF);
  w.writeUInt8((((toX & 3) << 6) | ((toY >> 4) & 0x3F)) & 0xFF);
  w.writeUInt8(((toY & 0xF) << 4) & 0xFF);
  w.writeUInt16LE(150); // speed
  return w.toBuffer();
}

/**
 * Simple AI tick — called periodically by the map server
 * Handles idle movement, chase, attack, and respawning.
 *
 * @param getPlayerPos  Returns (x,y) of a player by accountId
 * @param damagePlayer  Applies damage to a player and sends the packet
 * @param broadcast     Sends a packet to all players on a map
 */
export function tickMobAi(
  mapName: string,
  now: number,
  getPlayerPos?: GetPlayerPos,
  damagePlayer?: DamagePlayerFn,
  broadcast?: BroadcastFn,
): void {
  const mobs = mapMobs.get(mapName);
  if (!mobs) return;

  for (const mob of mobs) {
    if (mob.state === MobAiState.DEAD) continue;

    const def = getMobDef(mob.mobId);
    if (!def) continue;

    if (mob.state === MobAiState.IDLE) {
      // Random idle movement every 4-8 seconds
      if (now - mob.lastMoveTime > randomRange(4000, 8000)) {
        const newX = Math.max(1, Math.min(300, mob.x + randomRange(-3, 3)));
        const newY = Math.max(1, Math.min(300, mob.y + randomRange(-3, 3)));
        if (broadcast) broadcast(mapName, buildMobMovePacket(mob, newX, newY, now));
        mob.x = newX;
        mob.y = newY;
        mob.dir = randomRange(0, 7);
        mob.lastMoveTime = now;
      }
    } else if ((mob.state === MobAiState.CHASE || mob.state === MobAiState.ATTACK) && mob.targetAccountId !== null) {
      const targetPos = getPlayerPos?.(mob.targetAccountId);

      if (!targetPos) {
        // Target gone — reset
        mob.state = MobAiState.IDLE;
        mob.targetAccountId = null;
        continue;
      }

      const d = dist(mob.x, mob.y, targetPos.x, targetPos.y);

      // Leash: stop chasing if too far
      if (d > CHASE_RANGE) {
        mob.state = MobAiState.IDLE;
        mob.targetAccountId = null;
        continue;
      }

      if (d <= ATTACK_RANGE) {
        // Attack
        mob.state = MobAiState.ATTACK;
        if (now - mob.lastAttackTime >= def.adelay) {
          mob.lastAttackTime = now;
          const damage = calcMobDamage(mob, 0, 1); // playerDef/Vit passed as minimal; real values come from PlayerState
          log.debug(`Mob ${def.name} attacks account ${mob.targetAccountId} for ${damage}`);
          damagePlayer?.(mob.targetAccountId, damage);
        }
      } else {
        // Chase — step toward target
        mob.state = MobAiState.CHASE;
        if (now - mob.lastMoveTime > def.speed) {
          const newX = mob.x + Math.sign(targetPos.x - mob.x);
          const newY = mob.y + Math.sign(targetPos.y - mob.y);
          if (broadcast) broadcast(mapName, buildMobMovePacket(mob, newX, newY, now));
          mob.x = newX;
          mob.y = newY;
          mob.lastMoveTime = now;
        }
      }
    }
  }

  // Process respawns
  for (let i = deadMobs.length - 1; i >= 0; i--) {
    const dead = deadMobs[i];
    if (dead.map !== mapName) continue;
    if (now - dead.deathTime >= dead.respawnMs) {
      const def = getMobDef(dead.mobId);
      if (!def) { deadMobs.splice(i, 1); continue; }

      // Respawn
      dead.hp = def.hp;
      dead.state = MobAiState.IDLE;
      dead.targetAccountId = null;
      dead.x = randomRange(20, 280);
      dead.y = randomRange(20, 280);
      dead.dir = randomRange(0, 7);
      dead.lastMoveTime = now;
      dead.deathTime = 0;

      const mapMobList = mapMobs.get(mapName) ?? [];
      mapMobList.push(dead);
      mapMobs.set(mapName, mapMobList);
      deadMobs.splice(i, 1);

      log.debug(`Monster ${dead.gid} (${def.name}) respawned on ${mapName}`);
    }
  }
}

/**
 * Initialize spawns for all known maps
 */
export function initAllSpawns(): void {
  const maps = ['new_1-1', 'prontera', 'prt_fild01', 'prt_fild02'];
  for (const map of maps) {
    initMapSpawns(map);
  }
}
