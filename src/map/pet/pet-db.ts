/**
 * MidgardTS Pet Database
 * Pet definitions: tame items, food, loyalty, bonuses
 * Inspired by rAthena's pet_db.yml
 */

import { createLogger } from '../../common/logger/index.js';

const log = createLogger('PetDB');

export interface PetStatBonus {
  str?: number;
  agi?: number;
  vit?: number;
  int?: number;
  dex?: number;
  luk?: number;
  atk?: number;
  def?: number;
}

export interface PetDef {
  mobId: number;        // monster ID that can be tamed
  name: string;
  tameItemId: number;   // item used to tame
  eggItemId: number;    // egg item created
  foodItemId: number;   // food to restore intimacy
  accessoryItemId: number; // equippable pet accessory
  tameRate: number;     // per 10000
  hungerRate: number;   // intimacy decrease per hunger tick
  fullness: number;     // starting fullness
  intimacyStart: number;
  intimacyFed: number;  // intimacy gain per feeding
  intimacyHungry: number; // intimacy loss when hungry
  bonus: PetStatBonus;
}

const PET_DB: Map<number, PetDef> = new Map();

function reg(p: PetDef): void {
  PET_DB.set(p.mobId, p);
}

// Poring
reg({
  mobId: 1002, name: 'Poring',
  tameItemId: 619, eggItemId: 9001, foodItemId: 531, accessoryItemId: 10013,
  tameRate: 2000, hungerRate: 5, fullness: 100,
  intimacyStart: 250, intimacyFed: 50, intimacyHungry: -50,
  bonus: { luk: 2, atk: 5 },
});

// Chonchon
reg({
  mobId: 1011, name: 'Chonchon',
  tameItemId: 624, eggItemId: 9006, foodItemId: 537, accessoryItemId: 10007,
  tameRate: 1500, hungerRate: 6, fullness: 100,
  intimacyStart: 250, intimacyFed: 40, intimacyHungry: -50,
  bonus: { agi: 3, def: 2 },
});

// Spore
reg({
  mobId: 1014, name: 'Spore',
  tameItemId: 626, eggItemId: 9008, foodItemId: 537, accessoryItemId: 10017,
  tameRate: 1500, hungerRate: 5, fullness: 100,
  intimacyStart: 250, intimacyFed: 40, intimacyHungry: -50,
  bonus: { vit: 2, def: 3 },
});

// Condor
reg({
  mobId: 1009, name: 'Condor',
  tameItemId: 625, eggItemId: 9005, foodItemId: 537, accessoryItemId: 10009,
  tameRate: 1500, hungerRate: 6, fullness: 100,
  intimacyStart: 250, intimacyFed: 40, intimacyHungry: -50,
  bonus: { agi: 2, dex: 2 },
});

// Fabre
reg({
  mobId: 1007, name: 'Fabre',
  tameItemId: 621, eggItemId: 9003, foodItemId: 537, accessoryItemId: 10015,
  tameRate: 2000, hungerRate: 5, fullness: 100,
  intimacyStart: 250, intimacyFed: 50, intimacyHungry: -50,
  bonus: { vit: 1, str: 1 },
});

// Zombie
reg({
  mobId: 1015, name: 'Zombie',
  tameItemId: 628, eggItemId: 9010, foodItemId: 537, accessoryItemId: 10019,
  tameRate: 500, hungerRate: 8, fullness: 100,
  intimacyStart: 250, intimacyFed: 30, intimacyHungry: -80,
  bonus: { str: 2, atk: 5 },
});

// Desert Wolf
reg({
  mobId: 1113, name: 'Baby Desert Wolf',
  tameItemId: 634, eggItemId: 9016, foodItemId: 537, accessoryItemId: 10023,
  tameRate: 500, hungerRate: 7, fullness: 100,
  intimacyStart: 250, intimacyFed: 30, intimacyHungry: -80,
  bonus: { atk: 10, int: 1 },
});

export function getPetDef(mobId: number): PetDef | undefined {
  return PET_DB.get(mobId);
}

export function getAllPetDefs(): PetDef[] {
  return Array.from(PET_DB.values());
}

export function getPetDefByEgg(eggItemId: number): PetDef | undefined {
  for (const [, p] of PET_DB) {
    if (p.eggItemId === eggItemId) return p;
  }
  return undefined;
}

log.info(`Loaded ${PET_DB.size} pet definitions`);
