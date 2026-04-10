/**
 * MidgardTS Vending System
 * Player shop (vending) inspired by rAthena's vending.cpp
 */

import { getItemDef } from '../item/item-db.js';
import { loadInventory, removeItem, addItem, type InvItem } from '../item/inventory.js';
import { createLogger } from '../../common/logger/index.js';

const log = createLogger('Vending');

const MAX_VEND_ITEMS = 12;

export interface VendItem {
  inventoryId: number;
  amount: number;
  price: number;
  itemId: number;
  itemName: string;
}

export interface VendShop {
  accountId: number;
  charId: number;
  charName: string;
  title: string;
  map: string;
  x: number;
  y: number;
  items: VendItem[];
}

const vendShops = new Map<number, VendShop>();  // accountId -> shop

/**
 * Open a vending shop
 */
export function openVendShop(
  accountId: number, charId: number, charName: string,
  title: string, map: string, x: number, y: number,
  items: { inventoryId: number; amount: number; price: number }[],
): boolean {
  if (vendShops.has(accountId)) {
    log.warn(`Account ${accountId} already has a shop open`);
    return false;
  }

  if (title.length === 0 || title.length > 80) return false;
  if (items.length === 0 || items.length > MAX_VEND_ITEMS) return false;

  // Validate all prices/amounts before touching DB
  for (const req of items) {
    if (req.price <= 0 || req.price > 1_000_000_000) return false;
    if (req.amount <= 0) return false;
  }

  const vendItems: VendItem[] = [];
  const inv = loadInventory(charId);

  for (const req of items) {

    const invItem = inv.find((i) => i.id === req.inventoryId);
    if (!invItem) return false;
    if (invItem.equip !== 0) return false; // can't vend equipped items
    if (invItem.amount < req.amount) return false;

    const def = getItemDef(invItem.itemId);
    vendItems.push({
      inventoryId: req.inventoryId,
      amount: req.amount,
      price: req.price,
      itemId: invItem.itemId,
      itemName: def?.name ?? `Item#${invItem.itemId}`,
    });
  }

  vendShops.set(accountId, {
    accountId, charId, charName, title, map, x, y,
    items: vendItems,
  });

  log.info(`${charName} opened shop "${title}" with ${vendItems.length} items`);
  return true;
}

/**
 * Close vending shop
 */
export function closeVendShop(accountId: number): boolean {
  const shop = vendShops.get(accountId);
  if (!shop) return false;
  vendShops.delete(accountId);
  log.info(`${shop.charName} closed shop "${shop.title}"`);
  return true;
}

/**
 * Buy from a vending shop
 */
export function buyFromVend(
  buyerCharId: number,
  vendorAccountId: number,
  purchases: { index: number; amount: number }[],
): { success: boolean; totalCost: number } {
  const shop = vendShops.get(vendorAccountId);
  if (!shop) return { success: false, totalCost: 0 };

  let totalCost = 0;

  // Validate all purchases first
  for (const p of purchases) {
    if (p.index < 0 || p.index >= shop.items.length) return { success: false, totalCost: 0 };
    const item = shop.items[p.index];
    if (p.amount <= 0 || p.amount > item.amount) return { success: false, totalCost: 0 };
    totalCost += item.price * p.amount;
  }

  // TODO: Check buyer's zeny balance

  // Process
  for (const p of purchases) {
    const item = shop.items[p.index];

    // Remove from vendor's inventory
    removeItem(shop.charId, item.inventoryId, p.amount);

    // Add to buyer's inventory
    addItem(buyerCharId, item.itemId, p.amount);

    item.amount -= p.amount;
  }

  // Remove sold-out items
  shop.items = shop.items.filter((i) => i.amount > 0);

  // Auto-close if all items sold
  if (shop.items.length === 0) {
    closeVendShop(vendorAccountId);
  }

  log.info(`Vend purchase from "${shop.charName}": ${purchases.length} types, total ${totalCost}z`);
  return { success: true, totalCost };
}

/**
 * Get all vending shops on a map
 */
export function getVendShopsOnMap(map: string): VendShop[] {
  const shops: VendShop[] = [];
  for (const [, shop] of vendShops) {
    if (shop.map === map) shops.push(shop);
  }
  return shops;
}

/**
 * Get a specific vending shop
 */
export function getVendShop(accountId: number): VendShop | undefined {
  return vendShops.get(accountId);
}

/**
 * Check if account has an active vending shop
 */
export function isVending(accountId: number): boolean {
  return vendShops.has(accountId);
}
