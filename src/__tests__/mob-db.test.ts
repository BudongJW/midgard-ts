import { describe, it, expect } from 'vitest';
import { getMobDef, getAllMobs, getMapSpawns, MobRace, MobSize } from '../map/monster/mob-db.js';

describe('MobDB', () => {
  it('should have monsters loaded', () => {
    const all = getAllMobs();
    expect(all.length).toBeGreaterThan(5);
  });

  it('should find Poring by id', () => {
    const poring = getMobDef(1002);
    expect(poring).toBeDefined();
    expect(poring!.name).toBe('Poring');
    expect(poring!.level).toBe(1);
    expect(poring!.hp).toBe(50);
    expect(poring!.race).toBe(MobRace.PLANT);
    expect(poring!.size).toBe(MobSize.MEDIUM);
  });

  it('should have drops defined', () => {
    const poring = getMobDef(1002);
    expect(poring!.drops.length).toBeGreaterThan(0);
    for (const drop of poring!.drops) {
      expect(drop.itemId).toBeGreaterThan(0);
      expect(drop.rate).toBeGreaterThan(0);
      expect(drop.rate).toBeLessThanOrEqual(10000);
    }
  });

  it('should return map spawn config', () => {
    const spawns = getMapSpawns('new_1-1');
    expect(spawns).toBeDefined();
    expect(spawns!.spawns.length).toBeGreaterThan(0);
    expect(spawns!.spawns[0].mobId).toBe(1002); // Poring
  });

  it('should return undefined for unknown map', () => {
    expect(getMapSpawns('nonexistent_map')).toBeUndefined();
  });

  it('should return undefined for unknown mob id', () => {
    expect(getMobDef(99999)).toBeUndefined();
  });
});
