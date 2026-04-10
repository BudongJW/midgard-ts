import { describe, it, expect } from 'vitest';
import { getItemDef, getAllItems, getItemsByType, ItemType, EquipLocation } from '../map/item/item-db.js';

describe('ItemDB', () => {
  it('should have items loaded', () => {
    const all = getAllItems();
    expect(all.length).toBeGreaterThan(30);
  });

  it('should find Red Potion by id', () => {
    const item = getItemDef(501);
    expect(item).toBeDefined();
    expect(item!.name).toBe('Red Potion');
    expect(item!.type).toBe(ItemType.HEALING);
    expect(item!.hpRecover).toBe(45);
  });

  it('should find weapons with ATK', () => {
    const sword = getItemDef(1101);
    expect(sword).toBeDefined();
    expect(sword!.type).toBe(ItemType.WEAPON);
    expect(sword!.atk).toBeGreaterThan(0);
    expect(sword!.equipLoc).toBe(EquipLocation.HAND_R);
  });

  it('should filter by type', () => {
    const healing = getItemsByType(ItemType.HEALING);
    expect(healing.length).toBeGreaterThan(5);
    for (const item of healing) {
      expect(item.type).toBe(ItemType.HEALING);
    }
  });

  it('should return undefined for unknown id', () => {
    expect(getItemDef(99999)).toBeUndefined();
  });
});
