/**
 * MidgardTS Inventory System
 * Character inventory management inspired by rAthena's pc_inventory
 */

import { PacketWriter } from '../../common/packet/index.js';
import { queryAll, queryOne, execute } from '../../common/database/index.js';
import { getItemDef, type ItemDef, ItemType, EquipLocation } from './item-db.js';
import { createLogger } from '../../common/logger/index.js';

const log = createLogger('Inventory');

const MAX_INVENTORY = 100;

export interface InvItem {
  id: number;        // inventory row id
  charId: number;
  itemId: number;
  amount: number;
  equip: number;     // EquipLocation bitmask (0 = not equipped)
  identify: number;
  refine: number;
  card0: number;
  card1: number;
  card2: number;
  card3: number;
}

export function loadInventory(charId: number): InvItem[] {
  return queryAll<InvItem>(
    'SELECT * FROM inventory WHERE char_id = ? ORDER BY id',
    [charId],
  );
}

export function addItem(charId: number, itemId: number, amount: number): { success: boolean; invItem?: InvItem } {
  const def = getItemDef(itemId);
  if (!def) {
    log.warn(`Unknown item ${itemId}`);
    return { success: false };
  }

  // Check inventory size
  const currentCount = queryAll('SELECT id FROM inventory WHERE char_id = ?', [charId]).length;

  // Stackable items (non-equipment) can stack
  if (def.type !== ItemType.WEAPON && def.type !== ItemType.ARMOR) {
    const existing = queryOne<InvItem>(
      'SELECT * FROM inventory WHERE char_id = ? AND item_id = ? AND equip = 0',
      [charId, itemId],
    );

    if (existing) {
      execute('UPDATE inventory SET amount = amount + ? WHERE id = ?', [amount, existing.id]);
      const updated = queryOne<InvItem>('SELECT * FROM inventory WHERE id = ?', [existing.id]);
      return { success: true, invItem: updated };
    }
  }

  if (currentCount >= MAX_INVENTORY) {
    log.warn(`Inventory full for char ${charId}`);
    return { success: false };
  }

  const { lastId, success } = execute(
    'INSERT INTO inventory (char_id, item_id, amount, equip, identify, refine) VALUES (?, ?, ?, 0, 1, 0)',
    [charId, itemId, amount],
  );

  if (!success) return { success: false };

  const invItem = queryOne<InvItem>('SELECT * FROM inventory WHERE id = ?', [lastId]);
  return { success: true, invItem };
}

export function removeItem(charId: number, inventoryId: number, amount: number): boolean {
  const item = queryOne<InvItem>(
    'SELECT * FROM inventory WHERE id = ? AND char_id = ?',
    [inventoryId, charId],
  );

  if (!item) return false;

  if (item.equip !== 0) {
    log.warn(`Cannot remove equipped item ${inventoryId}`);
    return false;
  }

  if (item.amount <= amount) {
    execute('DELETE FROM inventory WHERE id = ?', [inventoryId]);
  } else {
    execute('UPDATE inventory SET amount = amount - ? WHERE id = ?', [amount, inventoryId]);
  }

  return true;
}

export function equipItem(charId: number, inventoryId: number): { success: boolean; unequipped: InvItem[] } {
  const item = queryOne<InvItem>(
    'SELECT * FROM inventory WHERE id = ? AND char_id = ?',
    [inventoryId, charId],
  );

  if (!item) return { success: false, unequipped: [] };

  const def = getItemDef(item.itemId);
  if (!def || def.equipLoc === EquipLocation.NONE) {
    return { success: false, unequipped: [] };
  }

  // Unequip conflicting items
  const conflicting = queryAll<InvItem>(
    'SELECT * FROM inventory WHERE char_id = ? AND equip & ? != 0 AND id != ?',
    [charId, def.equipLoc, inventoryId],
  );

  for (const c of conflicting) {
    execute('UPDATE inventory SET equip = 0 WHERE id = ?', [c.id]);
  }

  execute('UPDATE inventory SET equip = ? WHERE id = ?', [def.equipLoc, inventoryId]);

  return { success: true, unequipped: conflicting };
}

export function unequipItem(charId: number, inventoryId: number): boolean {
  const item = queryOne<InvItem>(
    'SELECT * FROM inventory WHERE id = ? AND char_id = ? AND equip != 0',
    [inventoryId, charId],
  );

  if (!item) return false;

  execute('UPDATE inventory SET equip = 0 WHERE id = ?', [inventoryId]);
  return true;
}

export function useItem(charId: number, inventoryId: number): { success: boolean; hpRecover: number; spRecover: number } {
  const item = queryOne<InvItem>(
    'SELECT * FROM inventory WHERE id = ? AND char_id = ?',
    [inventoryId, charId],
  );

  if (!item) return { success: false, hpRecover: 0, spRecover: 0 };

  const def = getItemDef(item.itemId);
  if (!def || (def.type !== ItemType.HEALING && def.type !== ItemType.USABLE)) {
    return { success: false, hpRecover: 0, spRecover: 0 };
  }

  // Consume 1 item
  if (!removeItem(charId, inventoryId, 1)) {
    return { success: false, hpRecover: 0, spRecover: 0 };
  }

  return {
    success: true,
    hpRecover: def.hpRecover ?? 0,
    spRecover: def.spRecover ?? 0,
  };
}

/** Calculate total equip ATK bonus */
export function getEquipAtk(charId: number): number {
  const equipped = queryAll<InvItem>(
    'SELECT * FROM inventory WHERE char_id = ? AND equip != 0',
    [charId],
  );
  let atk = 0;
  for (const item of equipped) {
    const def = getItemDef(item.itemId);
    if (def?.atk) atk += def.atk + item.refine * 2;
  }
  return atk;
}

/** Calculate total equip DEF bonus */
export function getEquipDef(charId: number): number {
  const equipped = queryAll<InvItem>(
    'SELECT * FROM inventory WHERE char_id = ? AND equip != 0',
    [charId],
  );
  let def_ = 0;
  for (const item of equipped) {
    const d = getItemDef(item.itemId);
    if (d?.def) def_ += d.def + item.refine;
  }
  return def_;
}
