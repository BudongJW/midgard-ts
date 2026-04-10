/**
 * MidgardTS Monster Spawner & AI
 * Handles monster instantiation, simple AI (idle/chase/attack), and respawn timers
 * Inspired by rAthena's mob.cpp
 */

import { getMobDef, getMapSpawns, type MobDef } from './mob-db.js';
import { createLogger } from '../../common/logger/index.js';

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

/**
 * Simple AI tick — called periodically by the map server
 * Handles idle movement and respawning
 */
export function tickMobAi(mapName: string, now: number): void {
  const mobs = mapMobs.get(mapName);
  if (!mobs) return;

  for (const mob of mobs) {
    if (mob.state === MobAiState.DEAD) continue;

    const def = getMobDef(mob.mobId);
    if (!def) continue;

    if (mob.state === MobAiState.IDLE) {
      // Random idle movement every 4-8 seconds
      if (now - mob.lastMoveTime > randomRange(4000, 8000)) {
        mob.x += randomRange(-3, 3);
        mob.y += randomRange(-3, 3);
        mob.x = Math.max(1, Math.min(300, mob.x));
        mob.y = Math.max(1, Math.min(300, mob.y));
        mob.dir = randomRange(0, 7);
        mob.lastMoveTime = now;
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
