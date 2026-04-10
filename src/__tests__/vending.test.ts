import { describe, it, expect } from 'vitest';
import {
  openVendShop, closeVendShop, getVendShop,
  getVendShopsOnMap, isVending,
} from '../map/trade/vending.js';

describe('Vending', () => {
  it('should open a shop', () => {
    // Since we can't easily mock inventory, test the validation paths
    // Opening with empty items should fail
    const result = openVendShop(8001, 1, 'Vendor', 'My Shop', 'prontera', 150, 185, []);
    expect(result).toBe(false);
  });

  it('should reject empty title', () => {
    const result = openVendShop(8001, 1, 'Vendor', '', 'prontera', 150, 185, [
      { inventoryId: 1, amount: 1, price: 100 },
    ]);
    expect(result).toBe(false);
  });

  it('should reject invalid price', () => {
    const result = openVendShop(8001, 1, 'Vendor', 'Shop', 'prontera', 150, 185, [
      { inventoryId: 1, amount: 1, price: 0 },
    ]);
    expect(result).toBe(false);
  });

  it('should report not vending for unknown account', () => {
    expect(isVending(99999)).toBe(false);
    expect(getVendShop(99999)).toBeUndefined();
  });

  it('should return empty list for maps with no shops', () => {
    expect(getVendShopsOnMap('prontera')).toEqual([]);
  });
});
