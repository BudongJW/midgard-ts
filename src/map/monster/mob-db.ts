/**
 * MidgardTS Monster Database
 * Static monster definitions inspired by rAthena's mob_db.yml
 */

import { createLogger } from '../../common/logger/index.js';

const log = createLogger('MobDB');

export enum MobRace {
  FORMLESS = 0, UNDEAD = 1, BRUTE = 2, PLANT = 3,
  INSECT = 4, FISH = 5, DEMON = 6, DEMI_HUMAN = 7,
  ANGEL = 8, DRAGON = 9,
}

export enum MobSize {
  SMALL = 0, MEDIUM = 1, LARGE = 2,
}

export enum MobElement {
  NEUTRAL = 0, WATER = 1, EARTH = 2, FIRE = 3,
  WIND = 4, POISON = 5, HOLY = 6, DARK = 7,
  GHOST = 8, UNDEAD = 9,
}

export interface MobDrop {
  itemId: number;
  rate: number;  // per 10000 (100.00%)
}

export interface MobDef {
  id: number;
  name: string;
  level: number;
  hp: number;
  sp: number;
  baseExp: number;
  jobExp: number;
  atk1: number;   // min ATK
  atk2: number;   // max ATK
  def: number;
  mdef: number;
  str: number; agi: number; vit: number;
  int: number; dex: number; luk: number;
  range: number;
  speed: number;      // walk speed (lower = faster)
  adelay: number;     // attack delay ms
  amotion: number;    // attack motion ms
  dmotion: number;    // damage motion ms
  race: MobRace;
  element: MobElement;
  elementLv: number;
  size: MobSize;
  drops: MobDrop[];
}

const MOB_DB: Map<number, MobDef> = new Map();

function reg(m: MobDef): void {
  MOB_DB.set(m.id, m);
}

// ======= Training Ground Monsters =======
reg({
  id: 1002, name: 'Poring', level: 1, hp: 50, sp: 0,
  baseExp: 2, jobExp: 1, atk1: 7, atk2: 10,
  def: 0, mdef: 5, str: 1, agi: 1, vit: 1, int: 0, dex: 6, luk: 30,
  range: 1, speed: 400, adelay: 1872, amotion: 672, dmotion: 480,
  race: MobRace.PLANT, element: MobElement.WATER, elementLv: 1, size: MobSize.MEDIUM,
  drops: [
    { itemId: 909, rate: 7000 },  // Jellyfish
    { itemId: 938, rate: 400 },   // Tooth of Bat (wrong but matches rAthena test data)
    { itemId: 512, rate: 1000 },  // Apple
    { itemId: 901, rate: 5500 },  // Jellopy
  ],
});

reg({
  id: 1007, name: 'Fabre', level: 2, hp: 63, sp: 0,
  baseExp: 3, jobExp: 2, atk1: 8, atk2: 11,
  def: 0, mdef: 0, str: 1, agi: 2, vit: 2, int: 0, dex: 7, luk: 5,
  range: 1, speed: 400, adelay: 1672, amotion: 672, dmotion: 480,
  race: MobRace.INSECT, element: MobElement.EARTH, elementLv: 1, size: MobSize.SMALL,
  drops: [
    { itemId: 914, rate: 6500 },  // Feather
    { itemId: 949, rate: 500 },
    { itemId: 908, rate: 3500 },  // Chrysalis
    { itemId: 512, rate: 200 },
  ],
});

reg({
  id: 1008, name: 'Pupa', level: 2, hp: 427, sp: 0,
  baseExp: 4, jobExp: 6, atk1: 1, atk2: 2,
  def: 0, mdef: 0, str: 1, agi: 1, vit: 1, int: 0, dex: 1, luk: 20,
  range: 1, speed: 1000, adelay: 1001, amotion: 1, dmotion: 1,
  race: MobRace.INSECT, element: MobElement.EARTH, elementLv: 1, size: MobSize.SMALL,
  drops: [
    { itemId: 908, rate: 5500 },  // Chrysalis
    { itemId: 938, rate: 600 },
    { itemId: 512, rate: 150 },
  ],
});

reg({
  id: 1009, name: 'Condor', level: 5, hp: 92, sp: 0,
  baseExp: 6, jobExp: 4, atk1: 11, atk2: 14,
  def: 0, mdef: 0, str: 1, agi: 13, vit: 5, int: 0, dex: 12, luk: 0,
  range: 1, speed: 150, adelay: 1148, amotion: 648, dmotion: 480,
  race: MobRace.BRUTE, element: MobElement.WIND, elementLv: 1, size: MobSize.MEDIUM,
  drops: [
    { itemId: 914, rate: 5500 },  // Feather
    { itemId: 907, rate: 3000 },  // Fluff
  ],
});

reg({
  id: 1010, name: 'Willow', level: 4, hp: 80, sp: 0,
  baseExp: 5, jobExp: 4, atk1: 9, atk2: 12,
  def: 5, mdef: 15, str: 1, agi: 4, vit: 4, int: 5, dex: 9, luk: 0,
  range: 1, speed: 200, adelay: 1672, amotion: 672, dmotion: 432,
  race: MobRace.PLANT, element: MobElement.EARTH, elementLv: 1, size: MobSize.SMALL,
  drops: [
    { itemId: 905, rate: 5000 },  // Stem
    { itemId: 907, rate: 2000 },  // Fluff
    { itemId: 512, rate: 100 },
  ],
});

reg({
  id: 1011, name: 'Chonchon', level: 4, hp: 67, sp: 0,
  baseExp: 5, jobExp: 3, atk1: 10, atk2: 13,
  def: 10, mdef: 0, str: 1, agi: 10, vit: 4, int: 5, dex: 12, luk: 2,
  range: 1, speed: 200, adelay: 1076, amotion: 576, dmotion: 480,
  race: MobRace.INSECT, element: MobElement.WIND, elementLv: 1, size: MobSize.SMALL,
  drops: [
    { itemId: 906, rate: 5500 },  // Worm Peeling
    { itemId: 909, rate: 2000 },  // Jellyfish
    { itemId: 601, rate: 100 },   // Fly Wing
  ],
});

reg({
  id: 1014, name: 'Spore', level: 6, hp: 106, sp: 0,
  baseExp: 7, jobExp: 5, atk1: 12, atk2: 15,
  def: 0, mdef: 5, str: 1, agi: 6, vit: 6, int: 0, dex: 11, luk: 0,
  range: 1, speed: 200, adelay: 1672, amotion: 672, dmotion: 288,
  race: MobRace.PLANT, element: MobElement.WATER, elementLv: 1, size: MobSize.SMALL,
  drops: [
    { itemId: 921, rate: 5500 },
    { itemId: 904, rate: 3500 },  // Sticky Mucus
  ],
});

reg({
  id: 1015, name: 'Zombie', level: 10, hp: 534, sp: 0,
  baseExp: 50, jobExp: 33, atk1: 67, atk2: 79,
  def: 0, mdef: 10, str: 1, agi: 8, vit: 7, int: 0, dex: 15, luk: 0,
  range: 1, speed: 400, adelay: 2612, amotion: 912, dmotion: 288,
  race: MobRace.UNDEAD, element: MobElement.UNDEAD, elementLv: 1, size: MobSize.MEDIUM,
  drops: [
    { itemId: 957, rate: 9000 },
    { itemId: 938, rate: 500 },
    { itemId: 958, rate: 500 },
  ],
});

reg({
  id: 1113, name: 'Desert Wolf', level: 27, hp: 1716, sp: 0,
  baseExp: 324, jobExp: 199, atk1: 126, atk2: 157,
  def: 0, mdef: 5, str: 1, agi: 27, vit: 27, int: 20, dex: 56, luk: 10,
  range: 1, speed: 200, adelay: 1120, amotion: 420, dmotion: 288,
  race: MobRace.BRUTE, element: MobElement.FIRE, elementLv: 1, size: MobSize.MEDIUM,
  drops: [
    { itemId: 952, rate: 5500 },  // Claw of Desert Wolf
    { itemId: 517, rate: 1000 },
    { itemId: 919, rate: 400 },
  ],
});

// ======= Map Spawn Definitions =======
export interface MapSpawn {
  mobId: number;
  count: number;
  respawnMs: number;  // respawn delay after kill
}

export interface MapSpawnDef {
  map: string;
  spawns: MapSpawn[];
}

const MAP_SPAWNS: MapSpawnDef[] = [
  {
    map: 'new_1-1',
    spawns: [
      { mobId: 1002, count: 15, respawnMs: 5000 },  // Poring
      { mobId: 1007, count: 10, respawnMs: 5000 },  // Fabre
      { mobId: 1008, count: 5, respawnMs: 8000 },   // Pupa
    ],
  },
  {
    map: 'prontera',
    spawns: [
      { mobId: 1002, count: 5, respawnMs: 10000 },  // Poring (light spawn in town)
    ],
  },
  {
    map: 'prt_fild01',
    spawns: [
      { mobId: 1002, count: 30, respawnMs: 5000 },  // Poring
      { mobId: 1007, count: 20, respawnMs: 5000 },  // Fabre
      { mobId: 1009, count: 15, respawnMs: 6000 },  // Condor
      { mobId: 1010, count: 15, respawnMs: 6000 },  // Willow
      { mobId: 1011, count: 10, respawnMs: 6000 },  // Chonchon
    ],
  },
  {
    map: 'prt_fild02',
    spawns: [
      { mobId: 1014, count: 25, respawnMs: 5000 },  // Spore
      { mobId: 1011, count: 20, respawnMs: 5000 },  // Chonchon
      { mobId: 1009, count: 15, respawnMs: 6000 },  // Condor
      { mobId: 1113, count: 5, respawnMs: 15000 },  // Desert Wolf
    ],
  },
];

export function getMobDef(id: number): MobDef | undefined {
  return MOB_DB.get(id);
}

export function getAllMobs(): MobDef[] {
  return Array.from(MOB_DB.values());
}

export function getMapSpawns(map: string): MapSpawnDef | undefined {
  return MAP_SPAWNS.find((s) => s.map === map);
}

log.info(`Loaded ${MOB_DB.size} monsters, ${MAP_SPAWNS.length} map spawn configs`);
