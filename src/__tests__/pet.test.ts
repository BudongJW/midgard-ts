import { describe, it, expect } from 'vitest';
import { getPetDef, getAllPetDefs, getPetDefByEgg } from '../map/pet/pet-db.js';
import { getIntimacyName } from '../map/pet/pet-handler.js';

describe('PetDB', () => {
  it('should have pets loaded', () => {
    const all = getAllPetDefs();
    expect(all.length).toBeGreaterThan(5);
  });

  it('should find Poring pet def', () => {
    const def = getPetDef(1002);
    expect(def).toBeDefined();
    expect(def!.name).toBe('Poring');
    expect(def!.tameRate).toBeGreaterThan(0);
    expect(def!.tameRate).toBeLessThanOrEqual(10000);
  });

  it('should find pet by egg item', () => {
    const def = getPetDefByEgg(9001);
    expect(def).toBeDefined();
    expect(def!.name).toBe('Poring');
  });

  it('should return undefined for unknown mob', () => {
    expect(getPetDef(99999)).toBeUndefined();
  });

  it('should have valid stat bonuses', () => {
    const def = getPetDef(1002)!;
    expect(def.bonus).toBeDefined();
    expect(def.bonus.luk).toBe(2);
    expect(def.bonus.atk).toBe(5);
  });
});

describe('Pet Intimacy', () => {
  it('should return correct intimacy names', () => {
    expect(getIntimacyName(950)).toBe('Loyal');
    expect(getIntimacyName(800)).toBe('Cordial');
    expect(getIntimacyName(500)).toBe('Neutral');
    expect(getIntimacyName(150)).toBe('Shy');
    expect(getIntimacyName(50)).toBe('Awkward');
  });
});
