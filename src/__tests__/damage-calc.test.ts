import { describe, it, expect } from 'vitest';
import { calcPlayerDamage, calcMobDamage, checkHit, type PlayerStats } from '../map/combat/damage-calc.js';
import { MobAiState, type MobInstance } from '../map/monster/mob-spawner.js';

// Need mob-db loaded for getMobDef
import '../map/monster/mob-db.js';

function makeMob(mobId: number): MobInstance {
  return {
    gid: 999999,
    mobId,
    map: 'test',
    x: 100, y: 100, dir: 0,
    hp: 50, maxHp: 50,
    state: MobAiState.IDLE,
    targetAccountId: null,
    lastMoveTime: 0, lastAttackTime: 0,
    respawnMs: 5000, deathTime: 0,
  };
}

describe('DamageCalc', () => {
  const basePlayer: PlayerStats = {
    baseLv: 10, str: 10, agi: 5, vit: 5,
    int: 1, dex: 10, luk: 1, equipAtk: 25, equipDef: 3,
  };

  it('should deal at least 1 damage to Poring', () => {
    const mob = makeMob(1002); // Poring
    const dmg = calcPlayerDamage(basePlayer, mob);
    expect(dmg).toBeGreaterThanOrEqual(1);
  });

  it('should scale damage with STR', () => {
    const mob = makeMob(1002);
    const weak = calcPlayerDamage({ ...basePlayer, str: 1 }, mob);
    const strong = calcPlayerDamage({ ...basePlayer, str: 50 }, mob);
    // Over many tests this won't always hold due to RNG, but with 49 STR diff it should
    expect(strong).toBeGreaterThan(weak);
  });

  it('should calculate mob damage against player', () => {
    const mob = makeMob(1015); // Zombie (atk 67-79)
    const dmg = calcMobDamage(mob, 3, 5);
    expect(dmg).toBeGreaterThanOrEqual(1);
  });

  it('should respect HIT/FLEE check bounds', () => {
    // Very high hit vs low flee -> should almost always hit
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      if (checkHit(99, 50, 1, 1)) hits++;
    }
    expect(hits).toBeGreaterThan(80);

    // Very low hit vs high flee -> should almost always miss
    let misses = 0;
    for (let i = 0; i < 100; i++) {
      if (!checkHit(1, 1, 99, 50)) misses++;
    }
    expect(misses).toBeGreaterThan(80);
  });
});
