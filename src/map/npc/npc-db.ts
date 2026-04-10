/**
 * MidgardTS NPC System
 * NPC definitions and dialogue inspired by rAthena's npc/ scripts
 *
 * In rAthena, NPCs are scripted in a custom language.
 * MidgardTS uses TypeScript definitions for type safety.
 */

import { createLogger } from '../../common/logger/index.js';

const log = createLogger('NPC');

export enum NpcType {
  WARP = 0,
  SHOP = 1,
  SCRIPT = 2,
  HEALER = 3,
  KAFRA = 4,  // Storage NPC
}

export interface ShopItem {
  itemId: number;
  price?: number; // Override buy price (0 = use item_db price)
}

export interface DialogueLine {
  text: string;
  next?: string; // Label to jump to
}

export interface DialogueChoice {
  text: string;
  label: string;
}

export interface DialogueNode {
  id: string;
  lines: string[];
  choices?: DialogueChoice[];
  action?: NpcAction;
}

export type NpcAction =
  | { type: 'heal' }
  | { type: 'save' }
  | { type: 'warp'; map: string; x: number; y: number }
  | { type: 'shop'; items: ShopItem[] }
  | { type: 'storage' }
  | { type: 'close' };

export interface NpcDef {
  id: number;
  name: string;
  sprite: number;   // NPC sprite ID
  map: string;
  x: number;
  y: number;
  dir: number;
  type: NpcType;
  dialogue?: Map<string, DialogueNode>;
  shopItems?: ShopItem[];
  warpTo?: { map: string; x: number; y: number };
}

const NPC_DB: Map<number, NpcDef> = new Map();
const NPC_BY_MAP: Map<string, NpcDef[]> = new Map();

let nextNpcId = 100000;

function registerNpc(npc: NpcDef): void {
  NPC_DB.set(npc.id, npc);
  const mapNpcs = NPC_BY_MAP.get(npc.map) ?? [];
  mapNpcs.push(npc);
  NPC_BY_MAP.set(npc.map, mapNpcs);
}

// ======= Training Ground NPCs =======
registerNpc({
  id: nextNpcId++,
  name: 'Healer',
  sprite: 105,
  map: 'new_1-1',
  x: 53, y: 120,
  dir: 4,
  type: NpcType.HEALER,
  dialogue: new Map([
    ['start', {
      id: 'start',
      lines: ['Welcome, adventurer!', 'I can heal your wounds.'],
      choices: [
        { text: 'Heal me please', label: 'heal' },
        { text: 'No thanks', label: 'end' },
      ],
    }],
    ['heal', {
      id: 'heal',
      lines: ['There you go! All healed up.'],
      action: { type: 'heal' },
    }],
    ['end', {
      id: 'end',
      lines: ['Take care out there!'],
      action: { type: 'close' },
    }],
  ]),
});

registerNpc({
  id: nextNpcId++,
  name: 'Tool Dealer',
  sprite: 83,
  map: 'new_1-1',
  x: 60, y: 115,
  dir: 4,
  type: NpcType.SHOP,
  shopItems: [
    { itemId: 501 },  // Red Potion
    { itemId: 502 },  // Orange Potion
    { itemId: 503 },  // Yellow Potion
    { itemId: 506 },  // Green Potion
    { itemId: 601 },  // Fly Wing
    { itemId: 602 },  // Butterfly Wing
    { itemId: 1750 }, // Arrow
  ],
});

registerNpc({
  id: nextNpcId++,
  name: 'Weapon Dealer',
  sprite: 83,
  map: 'new_1-1',
  x: 45, y: 115,
  dir: 4,
  type: NpcType.SHOP,
  shopItems: [
    { itemId: 1101 }, // Sword
    { itemId: 1201 }, // Knife
    { itemId: 1301 }, // Axe
    { itemId: 1401 }, // Javelin
    { itemId: 1501 }, // Club
    { itemId: 1601 }, // Rod
    { itemId: 1701 }, // Bow
  ],
});

registerNpc({
  id: nextNpcId++,
  name: 'Armor Dealer',
  sprite: 83,
  map: 'new_1-1',
  x: 45, y: 108,
  dir: 4,
  type: NpcType.SHOP,
  shopItems: [
    { itemId: 2101 }, // Guard
    { itemId: 2301 }, // Cotton Shirt
    { itemId: 2303 }, // Adventurer Suit
    { itemId: 2401 }, // Sandals
    { itemId: 2501 }, // Hood
  ],
});

registerNpc({
  id: nextNpcId++,
  name: 'Kafra Employee',
  sprite: 114,
  map: 'new_1-1',
  x: 53, y: 108,
  dir: 4,
  type: NpcType.KAFRA,
  dialogue: new Map([
    ['start', {
      id: 'start',
      lines: ['Welcome to Kafra Service!', 'How can I help you?'],
      choices: [
        { text: 'Save Point', label: 'save' },
        { text: 'Cancel', label: 'end' },
      ],
    }],
    ['save', {
      id: 'save',
      lines: ['Save point recorded!'],
      action: { type: 'save' },
    }],
    ['end', {
      id: 'end',
      lines: ['Thank you for using Kafra Service!'],
      action: { type: 'close' },
    }],
  ]),
});

// Warp: Training ground -> Prontera
registerNpc({
  id: nextNpcId++,
  name: 'Warp Portal',
  sprite: 139,
  map: 'new_1-1',
  x: 53, y: 130,
  dir: 0,
  type: NpcType.WARP,
  warpTo: { map: 'prontera', x: 156, y: 191 },
});

// ======= Prontera NPCs =======
registerNpc({
  id: nextNpcId++,
  name: 'Healer',
  sprite: 105,
  map: 'prontera',
  x: 150, y: 185,
  dir: 4,
  type: NpcType.HEALER,
  dialogue: new Map([
    ['start', {
      id: 'start',
      lines: ['Prontera Healer at your service.'],
      choices: [
        { text: 'Full heal', label: 'heal' },
        { text: 'Goodbye', label: 'end' },
      ],
    }],
    ['heal', { id: 'heal', lines: ['Healed!'], action: { type: 'heal' } }],
    ['end', { id: 'end', lines: ['Farewell.'], action: { type: 'close' } }],
  ]),
});

registerNpc({
  id: nextNpcId++,
  name: 'Tool Dealer',
  sprite: 83,
  map: 'prontera',
  x: 137, y: 225,
  dir: 4,
  type: NpcType.SHOP,
  shopItems: [
    { itemId: 501 },
    { itemId: 502 },
    { itemId: 503 },
    { itemId: 504 },
    { itemId: 505 },
    { itemId: 506 },
    { itemId: 601 },
    { itemId: 602 },
  ],
});

export function getNpcDef(id: number): NpcDef | undefined {
  return NPC_DB.get(id);
}

export function getNpcsOnMap(map: string): NpcDef[] {
  return NPC_BY_MAP.get(map) ?? [];
}

export function getAllNpcs(): NpcDef[] {
  return Array.from(NPC_DB.values());
}

log.info(`Loaded ${NPC_DB.size} NPCs across ${NPC_BY_MAP.size} maps`);
