/**
 * MidgardTS Item Database
 * Static item definitions inspired by rAthena's item_db.yml
 *
 * Item types follow rAthena convention:
 *  0=Healing, 2=Usable, 3=Etc, 4=Weapon, 5=Armor, 6=Card, 7=Pet Egg, 8=Pet Armor
 */

export enum ItemType {
  HEALING = 0,
  USABLE = 2,
  ETC = 3,
  WEAPON = 4,
  ARMOR = 5,
  CARD = 6,
  PET_EGG = 7,
  PET_ARMOR = 8,
}

export enum EquipLocation {
  NONE      = 0x0000,
  HEAD_LOW  = 0x0001,
  HEAD_MID  = 0x0200,
  HEAD_TOP  = 0x0100,
  ARMOR     = 0x0010,
  HAND_L    = 0x0020,
  HAND_R    = 0x0002,
  GARMENT   = 0x0004,
  SHOES     = 0x0040,
  ACCESSORY_L = 0x0008,
  ACCESSORY_R = 0x0080,
}

export interface ItemDef {
  id: number;
  name: string;
  type: ItemType;
  buy: number;
  sell: number;
  weight: number;
  atk?: number;
  def?: number;
  range?: number;
  slots?: number;
  equipLoc: EquipLocation;
  weaponLv?: number;
  description?: string;
  // Healing
  hpRecover?: number;
  spRecover?: number;
}

/**
 * Base item database — a representative subset of RO items
 * In production, this would be loaded from item_db.yml
 */
const ITEM_DB: Map<number, ItemDef> = new Map();

function reg(item: ItemDef): void {
  ITEM_DB.set(item.id, item);
}

// ======= Healing Items =======
reg({ id: 501, name: 'Red Potion', type: ItemType.HEALING, buy: 50, sell: 25, weight: 70, equipLoc: EquipLocation.NONE, hpRecover: 45 });
reg({ id: 502, name: 'Orange Potion', type: ItemType.HEALING, buy: 200, sell: 100, weight: 100, equipLoc: EquipLocation.NONE, hpRecover: 105 });
reg({ id: 503, name: 'Yellow Potion', type: ItemType.HEALING, buy: 550, sell: 275, weight: 130, equipLoc: EquipLocation.NONE, hpRecover: 175 });
reg({ id: 504, name: 'White Potion', type: ItemType.HEALING, buy: 1200, sell: 600, weight: 150, equipLoc: EquipLocation.NONE, hpRecover: 325 });
reg({ id: 505, name: 'Blue Potion', type: ItemType.HEALING, buy: 5000, sell: 2500, weight: 150, equipLoc: EquipLocation.NONE, spRecover: 60 });
reg({ id: 506, name: 'Green Potion', type: ItemType.HEALING, buy: 40, sell: 20, weight: 70, equipLoc: EquipLocation.NONE });
reg({ id: 512, name: 'Apple', type: ItemType.HEALING, buy: 15, sell: 7, weight: 20, equipLoc: EquipLocation.NONE, hpRecover: 16 });
reg({ id: 513, name: 'Banana', type: ItemType.HEALING, buy: 15, sell: 7, weight: 20, equipLoc: EquipLocation.NONE, hpRecover: 17 });
reg({ id: 519, name: 'Milk', type: ItemType.HEALING, buy: 25, sell: 12, weight: 30, equipLoc: EquipLocation.NONE, hpRecover: 27 });
reg({ id: 526, name: 'Royal Jelly', type: ItemType.HEALING, buy: 7000, sell: 3500, weight: 150, equipLoc: EquipLocation.NONE, hpRecover: 325, spRecover: 40 });
reg({ id: 547, name: 'Condensed White Potion', type: ItemType.HEALING, buy: 0, sell: 250, weight: 100, equipLoc: EquipLocation.NONE, hpRecover: 435 });

// ======= Usable Items =======
reg({ id: 601, name: 'Fly Wing', type: ItemType.USABLE, buy: 60, sell: 30, weight: 50, equipLoc: EquipLocation.NONE });
reg({ id: 602, name: 'Butterfly Wing', type: ItemType.USABLE, buy: 300, sell: 150, weight: 50, equipLoc: EquipLocation.NONE });
reg({ id: 678, name: 'Poison Bottle', type: ItemType.USABLE, buy: 5000, sell: 2500, weight: 100, equipLoc: EquipLocation.NONE });

// ======= Etc Items (monster drops) =======
reg({ id: 901, name: 'Jellopy', type: ItemType.ETC, buy: 6, sell: 3, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 902, name: 'Skull', type: ItemType.ETC, buy: 0, sell: 0, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 904, name: 'Sticky Mucus', type: ItemType.ETC, buy: 70, sell: 35, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 905, name: 'Stem', type: ItemType.ETC, buy: 6, sell: 3, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 906, name: 'Worm Peeling', type: ItemType.ETC, buy: 18, sell: 9, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 907, name: 'Fluff', type: ItemType.ETC, buy: 4, sell: 2, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 908, name: 'Chrysalis', type: ItemType.ETC, buy: 4, sell: 2, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 909, name: 'Jellyfish', type: ItemType.ETC, buy: 36, sell: 18, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 910, name: 'Garlet', type: ItemType.ETC, buy: 10, sell: 5, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 911, name: 'Scell', type: ItemType.ETC, buy: 18, sell: 9, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 914, name: 'Feather', type: ItemType.ETC, buy: 10, sell: 5, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 938, name: 'Tooth of Bat', type: ItemType.ETC, buy: 34, sell: 17, weight: 10, equipLoc: EquipLocation.NONE });
reg({ id: 952, name: 'Claw of Desert Wolf', type: ItemType.ETC, buy: 52, sell: 26, weight: 10, equipLoc: EquipLocation.NONE });

// ======= Weapons =======
reg({ id: 1101, name: 'Sword', type: ItemType.WEAPON, buy: 100, sell: 50, weight: 500, atk: 25, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1104, name: 'Falchion', type: ItemType.WEAPON, buy: 1500, sell: 750, weight: 600, atk: 39, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1108, name: 'Blade', type: ItemType.WEAPON, buy: 2900, sell: 1450, weight: 700, atk: 53, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1116, name: 'Katana', type: ItemType.WEAPON, buy: 2000, sell: 1000, weight: 1000, atk: 60, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1201, name: 'Knife', type: ItemType.WEAPON, buy: 50, sell: 25, weight: 400, atk: 17, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1209, name: 'Stiletto', type: ItemType.WEAPON, buy: 3250, sell: 1625, weight: 600, atk: 47, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 2 });
reg({ id: 1301, name: 'Axe', type: ItemType.WEAPON, buy: 500, sell: 250, weight: 800, atk: 38, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1401, name: 'Javelin', type: ItemType.WEAPON, buy: 150, sell: 75, weight: 500, atk: 28, range: 3, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1501, name: 'Club', type: ItemType.WEAPON, buy: 120, sell: 60, weight: 700, atk: 23, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1601, name: 'Rod', type: ItemType.WEAPON, buy: 50, sell: 25, weight: 400, atk: 15, range: 1, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });
reg({ id: 1701, name: 'Bow', type: ItemType.WEAPON, buy: 1000, sell: 500, weight: 500, atk: 15, range: 5, slots: 3, equipLoc: EquipLocation.HAND_R, weaponLv: 1 });

// ======= Armor =======
reg({ id: 2101, name: 'Guard', type: ItemType.ARMOR, buy: 500, sell: 250, weight: 300, def: 3, equipLoc: EquipLocation.HAND_L });
reg({ id: 2104, name: 'Buckler', type: ItemType.ARMOR, buy: 14000, sell: 7000, weight: 600, def: 4, equipLoc: EquipLocation.HAND_L });
reg({ id: 2301, name: 'Cotton Shirt', type: ItemType.ARMOR, buy: 10, sell: 5, weight: 100, def: 1, equipLoc: EquipLocation.ARMOR });
reg({ id: 2303, name: 'Adventurer Suit', type: ItemType.ARMOR, buy: 1000, sell: 500, weight: 400, def: 3, equipLoc: EquipLocation.ARMOR });
reg({ id: 2305, name: 'Coat', type: ItemType.ARMOR, buy: 5500, sell: 2750, weight: 500, def: 4, equipLoc: EquipLocation.ARMOR });
reg({ id: 2401, name: 'Sandals', type: ItemType.ARMOR, buy: 400, sell: 200, weight: 200, def: 1, equipLoc: EquipLocation.SHOES });
reg({ id: 2402, name: 'Shoes', type: ItemType.ARMOR, buy: 3500, sell: 1750, weight: 400, def: 2, equipLoc: EquipLocation.SHOES });
reg({ id: 2501, name: 'Hood', type: ItemType.ARMOR, buy: 1000, sell: 500, weight: 200, def: 1, equipLoc: EquipLocation.GARMENT });
reg({ id: 2502, name: 'Muffler', type: ItemType.ARMOR, buy: 5000, sell: 2500, weight: 400, def: 2, equipLoc: EquipLocation.GARMENT });
reg({ id: 2601, name: 'Ring', type: ItemType.ARMOR, buy: 30000, sell: 15000, weight: 100, def: 0, equipLoc: EquipLocation.ACCESSORY_L });

// ======= Headgears =======
reg({ id: 2201, name: 'Hairband', type: ItemType.ARMOR, buy: 400, sell: 200, weight: 100, def: 1, equipLoc: EquipLocation.HEAD_TOP });
reg({ id: 2209, name: 'Ribbon', type: ItemType.ARMOR, buy: 800, sell: 400, weight: 100, def: 1, equipLoc: EquipLocation.HEAD_TOP });
reg({ id: 2220, name: 'Hat', type: ItemType.ARMOR, buy: 1000, sell: 500, weight: 200, def: 2, equipLoc: EquipLocation.HEAD_TOP });
reg({ id: 2228, name: 'Cap', type: ItemType.ARMOR, buy: 2000, sell: 1000, weight: 200, def: 3, equipLoc: EquipLocation.HEAD_TOP });
reg({ id: 2234, name: 'Helm', type: ItemType.ARMOR, buy: 44000, sell: 22000, weight: 600, def: 6, equipLoc: EquipLocation.HEAD_TOP });
reg({ id: 2235, name: 'Circlet', type: ItemType.ARMOR, buy: 7500, sell: 3750, weight: 300, def: 3, equipLoc: EquipLocation.HEAD_TOP });

// ======= Arrows =======
reg({ id: 1750, name: 'Arrow', type: ItemType.ETC, buy: 1, sell: 0, weight: 1, equipLoc: EquipLocation.NONE });
reg({ id: 1751, name: 'Silver Arrow', type: ItemType.ETC, buy: 3, sell: 1, weight: 1, equipLoc: EquipLocation.NONE });
reg({ id: 1752, name: 'Fire Arrow', type: ItemType.ETC, buy: 3, sell: 1, weight: 1, equipLoc: EquipLocation.NONE });

export function getItemDef(id: number): ItemDef | undefined {
  return ITEM_DB.get(id);
}

export function getAllItems(): ItemDef[] {
  return Array.from(ITEM_DB.values());
}

export function getItemsByType(type: ItemType): ItemDef[] {
  return getAllItems().filter((i) => i.type === type);
}
