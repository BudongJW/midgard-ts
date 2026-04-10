/**
 * MidgardTS Damage Calculator
 * Basic damage formula inspired by rAthena's battle.cpp
 *
 * Simplified RO damage formula:
 *   ATK = StatusATK + WeaponATK
 *   StatusATK = BaseLv/4 + STR + DEX/5 + LUK/3
 *   FinalDmg = max(1, ATK - targetDEF) * variance
 */

import { getMobDef, type MobInstance } from '../monster/mob-db.js';

export interface PlayerStats {
  baseLv: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  equipAtk: number;
  equipDef: number;
}

function randomVariance(): number {
  // 95% ~ 105% damage variance (rAthena style)
  return 0.95 + Math.random() * 0.10;
}

/**
 * Calculate player -> monster damage
 */
export function calcPlayerDamage(player: PlayerStats, mob: MobInstance): number {
  const def = getMobDef(mob.mobId);
  if (!def) return 1;

  const statusAtk = Math.floor(player.baseLv / 4) + player.str + Math.floor(player.dex / 5) + Math.floor(player.luk / 3);
  const totalAtk = statusAtk + player.equipAtk;
  const targetDef = def.def;

  let damage = Math.floor((totalAtk - targetDef) * randomVariance());

  // Critical hit check: LUK/3 % chance
  const critChance = Math.floor(player.luk / 3);
  if (Math.random() * 100 < critChance) {
    damage = Math.floor(damage * 1.4); // 140% on crit
  }

  return Math.max(1, damage);
}

/**
 * Calculate monster -> player damage
 */
export function calcMobDamage(mob: MobInstance, playerDef: number, playerVit: number): number {
  const def = getMobDef(mob.mobId);
  if (!def) return 1;

  const mobAtk = def.atk1 + Math.floor(Math.random() * (def.atk2 - def.atk1 + 1));
  const softDef = Math.floor(playerVit / 2);   // VIT soft def
  const hardDef = playerDef;                     // equip DEF

  let damage = Math.floor((mobAtk - hardDef) * randomVariance()) - softDef;
  return Math.max(1, damage);
}

/**
 * Check if attack hits (simplified HIT/FLEE)
 * HIT = DEX + BaseLv
 * FLEE = AGI + BaseLv
 */
export function checkHit(attackerDex: number, attackerLv: number, defenderAgi: number, defenderLv: number): boolean {
  const hit = attackerDex + attackerLv;
  const flee = defenderAgi + defenderLv;
  const hitRate = Math.min(95, Math.max(5, 80 + hit - flee)); // 5% ~ 95%
  return Math.random() * 100 < hitRate;
}
