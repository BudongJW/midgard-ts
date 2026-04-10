/**
 * MidgardTS Pet Handler
 * Pet taming, hatching, feeding, intimacy, stat bonuses
 * Inspired by rAthena's pet.cpp
 */

import { getPetDef, getPetDefByEgg, type PetDef, type PetStatBonus } from './pet-db.js';
import { addItem, removeItem } from '../item/inventory.js';
import { createLogger } from '../../common/logger/index.js';

const log = createLogger('Pet');

export enum PetStatus {
  EGG = 0,
  IDLE = 1,
  FOLLOW = 2,
}

export interface PetInstance {
  id: number;          // unique pet instance id
  charId: number;
  mobId: number;
  name: string;
  intimacy: number;    // 0~1000 (loyal at 900+)
  hunger: number;      // 0~100 (hungry at 10-)
  status: PetStatus;
  eggInventoryId: number; // inventory ID of the egg item
  hasAccessory: boolean;
  lastFeedTime: number;
  lastHungerTick: number;
}

let nextPetId = 1;

/** Active (hatched) pets per character */
const activePets = new Map<number, PetInstance>();  // charId -> pet

/** All pets per character (including eggs) */
const allPets = new Map<number, PetInstance[]>();     // charId -> pets[]

const HUNGER_INTERVAL = 60_000;  // hunger tick every 60s
const INTIMACY_MAX = 1000;
const INTIMACY_LOYAL = 900;

/**
 * Attempt to tame a monster
 * Returns the pet egg inventory item if successful
 */
export function attemptTame(
  charId: number, mobId: number, tameItemInventoryId: number,
): { success: boolean; petId?: number } {
  const def = getPetDef(mobId);
  if (!def) return { success: false };

  // Consume tame item
  if (!removeItem(charId, tameItemInventoryId, 1)) {
    return { success: false };
  }

  // Tame chance
  const roll = Math.floor(Math.random() * 10000);
  if (roll >= def.tameRate) {
    log.debug(`Tame failed for mob ${mobId} (roll ${roll} >= ${def.tameRate})`);
    return { success: false };
  }

  // Create pet
  const pet: PetInstance = {
    id: nextPetId++,
    charId,
    mobId,
    name: def.name,
    intimacy: def.intimacyStart,
    hunger: def.fullness,
    status: PetStatus.EGG,
    eggInventoryId: 0,
    hasAccessory: false,
    lastFeedTime: Date.now(),
    lastHungerTick: Date.now(),
  };

  // Give egg item
  const eggResult = addItem(charId, def.eggItemId, 1);
  if (eggResult.success && eggResult.invItem) {
    pet.eggInventoryId = eggResult.invItem.id;
  }

  const charPets = allPets.get(charId) ?? [];
  charPets.push(pet);
  allPets.set(charId, charPets);

  log.info(`${def.name} tamed by char ${charId}! (petId=${pet.id})`);
  return { success: true, petId: pet.id };
}

/**
 * Hatch a pet egg
 */
export function hatchPet(charId: number, petId: number): boolean {
  // Already have an active pet?
  if (activePets.has(charId)) {
    log.warn(`Char ${charId} already has an active pet`);
    return false;
  }

  const charPets = allPets.get(charId);
  if (!charPets) return false;

  const pet = charPets.find((p) => p.id === petId);
  if (!pet || pet.status !== PetStatus.EGG) return false;

  pet.status = PetStatus.FOLLOW;
  pet.lastHungerTick = Date.now();
  activePets.set(charId, pet);

  log.info(`Pet "${pet.name}" hatched for char ${charId}`);
  return true;
}

/**
 * Return pet to egg
 */
export function returnPetToEgg(charId: number): boolean {
  const pet = activePets.get(charId);
  if (!pet) return false;

  pet.status = PetStatus.EGG;
  activePets.delete(charId);

  log.info(`Pet "${pet.name}" returned to egg for char ${charId}`);
  return true;
}

/**
 * Feed the active pet
 */
export function feedPet(charId: number, foodInventoryId: number): { success: boolean; intimacy: number } {
  const pet = activePets.get(charId);
  if (!pet) return { success: false, intimacy: 0 };

  const def = getPetDef(pet.mobId);
  if (!def) return { success: false, intimacy: 0 };

  // Consume food item
  if (!removeItem(charId, foodInventoryId, 1)) {
    return { success: false, intimacy: 0 };
  }

  // Restore hunger
  pet.hunger = Math.min(100, pet.hunger + 30);
  pet.lastFeedTime = Date.now();

  // Intimacy gain depends on hunger state
  if (pet.hunger > 75) {
    // Overfed: slight intimacy loss
    pet.intimacy = Math.max(0, pet.intimacy - 10);
  } else {
    pet.intimacy = Math.min(INTIMACY_MAX, pet.intimacy + def.intimacyFed);
  }

  log.debug(`Pet "${pet.name}" fed: hunger=${pet.hunger}, intimacy=${pet.intimacy}`);
  return { success: true, intimacy: pet.intimacy };
}

/**
 * Rename pet
 */
export function renamePet(charId: number, newName: string): boolean {
  const pet = activePets.get(charId);
  if (!pet) return false;
  if (newName.length === 0 || newName.length > 24) return false;

  pet.name = newName;
  log.info(`Pet renamed to "${newName}" for char ${charId}`);
  return true;
}

/**
 * Hunger tick - called periodically
 */
export function tickPetHunger(charId: number, now: number): void {
  const pet = activePets.get(charId);
  if (!pet) return;

  const def = getPetDef(pet.mobId);
  if (!def) return;

  const elapsed = now - pet.lastHungerTick;
  if (elapsed < HUNGER_INTERVAL) return;

  const ticks = Math.floor(elapsed / HUNGER_INTERVAL);
  pet.lastHungerTick = now;

  pet.hunger = Math.max(0, pet.hunger - def.hungerRate * ticks);

  // Intimacy loss when hungry
  if (pet.hunger <= 10) {
    pet.intimacy = Math.max(0, pet.intimacy + def.intimacyHungry * ticks);
  }

  // Pet runs away if intimacy reaches 0
  if (pet.intimacy <= 0) {
    activePets.delete(charId);
    const charPets = allPets.get(charId);
    if (charPets) {
      const idx = charPets.indexOf(pet);
      if (idx >= 0) charPets.splice(idx, 1);
    }
    log.info(`Pet "${pet.name}" ran away from char ${charId} (intimacy 0)`);
  }
}

/**
 * Get active pet's stat bonuses (only if loyal, intimacy >= 900)
 */
export function getPetBonus(charId: number): PetStatBonus {
  const pet = activePets.get(charId);
  if (!pet || pet.intimacy < INTIMACY_LOYAL) return {};

  const def = getPetDef(pet.mobId);
  if (!def) return {};

  // Accessory doubles bonus
  const mult = pet.hasAccessory ? 2 : 1;
  const bonus: PetStatBonus = {};

  if (def.bonus.str) bonus.str = def.bonus.str * mult;
  if (def.bonus.agi) bonus.agi = def.bonus.agi * mult;
  if (def.bonus.vit) bonus.vit = def.bonus.vit * mult;
  if (def.bonus.int) bonus.int = def.bonus.int * mult;
  if (def.bonus.dex) bonus.dex = def.bonus.dex * mult;
  if (def.bonus.luk) bonus.luk = def.bonus.luk * mult;
  if (def.bonus.atk) bonus.atk = def.bonus.atk * mult;
  if (def.bonus.def) bonus.def = def.bonus.def * mult;

  return bonus;
}

export function getActivePet(charId: number): PetInstance | undefined {
  return activePets.get(charId);
}

export function getCharPets(charId: number): PetInstance[] {
  return allPets.get(charId) ?? [];
}

/**
 * Get pet intimacy level name
 */
export function getIntimacyName(intimacy: number): string {
  if (intimacy >= 900) return 'Loyal';
  if (intimacy >= 750) return 'Cordial';
  if (intimacy >= 250) return 'Neutral';
  if (intimacy >= 100) return 'Shy';
  return 'Awkward';
}
