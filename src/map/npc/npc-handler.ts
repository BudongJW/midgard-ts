/**
 * MidgardTS NPC Handler
 * Handles NPC interactions: dialogue, shops, warps
 */

import { PacketWriter, PacketId } from '../../common/packet/index.js';
import { getNpcDef, getNpcsOnMap, NpcType, type NpcDef, type DialogueNode } from './npc-db.js';
import { addItem, removeItem, loadInventory, type InvItem } from '../item/inventory.js';
import { getItemDef } from '../item/item-db.js';
import { createLogger } from '../../common/logger/index.js';
import type { Socket } from 'node:net';

const log = createLogger('NPC');

/** Per-session NPC dialogue state */
export interface NpcDialogueState {
  npcId: number;
  currentNode: string;
}

const dialogueStates = new Map<number, NpcDialogueState>(); // accountId -> state

/**
 * Send all NPC spawn packets for a given map to the client
 */
export function sendNpcSpawns(socket: Socket, mapName: string): void {
  const npcs = getNpcsOnMap(mapName);
  for (const npc of npcs) {
    const writer = new PacketWriter(64);
    // ZC_NOTIFY_STANDENTRY_NPC (0x007c) — simplified spawn packet
    // Real RO uses a larger struct, but for basic display:
    // [header 2][id 4][speed 2][type 2][x 2][y 2][dir 2] = 16 bytes
    writer.writeUInt16LE(PacketId.ZC_NOTIFY_STANDENTRY_NPC);
    writer.writeUInt32LE(npc.id);            // GID (NPC ID used as object ID)
    writer.writeUInt16LE(200);               // speed
    writer.writeUInt16LE(npc.sprite);        // sprite/job
    writer.writeUInt16LE(npc.x);
    writer.writeUInt16LE(npc.y);
    writer.writeUInt16LE(npc.dir);
    socket.write(writer.toBuffer());
  }
  log.debug(`Sent ${npcs.length} NPC spawns for map ${mapName}`);
}

/**
 * Handle CZ_CONTACTNPC (0x0090): Player clicks an NPC
 * Packet: [header 2][npcId 4][type 1] = 7 bytes
 */
export function handleNpcClick(
  accountId: number, charId: number, npcId: number, socket: Socket,
): void {
  const npc = getNpcDef(npcId);
  if (!npc) {
    log.warn(`NPC ${npcId} not found`);
    return;
  }

  switch (npc.type) {
    case NpcType.WARP:
      handleWarp(socket, npc);
      break;
    case NpcType.SHOP:
      sendShopList(socket, npc);
      break;
    case NpcType.HEALER:
    case NpcType.KAFRA:
    case NpcType.SCRIPT:
      startDialogue(accountId, socket, npc);
      break;
  }
}

function handleWarp(socket: Socket, npc: NpcDef): void {
  if (!npc.warpTo) return;
  const writer = new PacketWriter(22);
  writer.writeUInt16LE(PacketId.ZC_NPCACK_MAPMOVE);
  writer.writeString(npc.warpTo.map + '.gat', 16);
  writer.writeUInt16LE(npc.warpTo.x);
  writer.writeUInt16LE(npc.warpTo.y);
  socket.write(writer.toBuffer());
  log.info(`Warp -> ${npc.warpTo.map} (${npc.warpTo.x},${npc.warpTo.y})`);
}

function startDialogue(accountId: number, socket: Socket, npc: NpcDef): void {
  if (!npc.dialogue) return;
  const startNode = npc.dialogue.get('start');
  if (!startNode) return;

  dialogueStates.set(accountId, { npcId: npc.id, currentNode: 'start' });
  sendDialogueNode(accountId, socket, npc, startNode);
}

function sendDialogueNode(
  accountId: number, socket: Socket, npc: NpcDef, node: DialogueNode,
): void {
  // Send each line as ZC_SAY_DIALOG
  for (const line of node.lines) {
    const msgBuf = Buffer.from(line, 'utf-8');
    const writer = new PacketWriter(8 + msgBuf.length + 1);
    writer.writeUInt16LE(PacketId.ZC_SAY_DIALOG);
    writer.writeUInt16LE(8 + msgBuf.length + 1); // packet length
    writer.writeUInt32LE(npc.id);
    writer.writeBytes(msgBuf);
    writer.writeUInt8(0);
    socket.write(writer.toBuffer());
  }

  if (node.choices && node.choices.length > 0) {
    // Send menu list
    const menuStr = node.choices.map((c) => c.text).join(':');
    const menuBuf = Buffer.from(menuStr, 'utf-8');
    const writer = new PacketWriter(8 + menuBuf.length + 1);
    writer.writeUInt16LE(PacketId.ZC_MENU_LIST);
    writer.writeUInt16LE(8 + menuBuf.length + 1);
    writer.writeUInt32LE(npc.id);
    writer.writeBytes(menuBuf);
    writer.writeUInt8(0);
    socket.write(writer.toBuffer());
  } else if (node.action) {
    // Execute action and close
    executeAction(accountId, socket, npc, node);
  } else {
    // Send "next" button
    const writer = new PacketWriter(6);
    writer.writeUInt16LE(PacketId.ZC_WAIT_DIALOG);
    writer.writeUInt32LE(npc.id);
    socket.write(writer.toBuffer());
  }
}

/**
 * Handle CZ_CHOOSE_MENU (0x00b8): Player picks a dialogue choice
 * Packet: [header 2][npcId 4][choice 1] = 7 bytes
 */
export function handleMenuChoice(accountId: number, npcId: number, choice: number, socket: Socket): void {
  const state = dialogueStates.get(accountId);
  if (!state || state.npcId !== npcId) return;

  const npc = getNpcDef(npcId);
  if (!npc?.dialogue) return;

  const currentNode = npc.dialogue.get(state.currentNode);
  if (!currentNode?.choices) return;

  const idx = choice - 1; // RO menu choice is 1-indexed
  if (idx < 0 || idx >= currentNode.choices.length) {
    closeDialogue(accountId, socket, npcId);
    return;
  }

  const nextLabel = currentNode.choices[idx].label;
  const nextNode = npc.dialogue.get(nextLabel);
  if (!nextNode) {
    closeDialogue(accountId, socket, npcId);
    return;
  }

  state.currentNode = nextLabel;
  sendDialogueNode(accountId, socket, npc, nextNode);
}

/**
 * Handle CZ_REQ_NEXT_SCRIPT (0x00b9): Player presses "next" in dialogue
 * Packet: [header 2][npcId 4] = 6 bytes
 */
export function handleNextScript(accountId: number, npcId: number, socket: Socket): void {
  const state = dialogueStates.get(accountId);
  if (!state || state.npcId !== npcId) return;

  const npc = getNpcDef(npcId);
  if (!npc?.dialogue) return;

  const currentNode = npc.dialogue.get(state.currentNode);
  if (!currentNode) {
    closeDialogue(accountId, socket, npcId);
    return;
  }

  // If there's a "next" pointer, follow it
  if (currentNode.lines.length > 0 && currentNode.action) {
    executeAction(accountId, socket, npc, currentNode);
  } else {
    closeDialogue(accountId, socket, npcId);
  }
}

/**
 * Handle CZ_CLOSE_DIALOG (0x0146): Player closes dialogue
 */
export function handleCloseDialog(accountId: number): void {
  dialogueStates.delete(accountId);
}

function executeAction(
  accountId: number, socket: Socket, npc: NpcDef, node: DialogueNode,
): void {
  if (!node.action) {
    closeDialogue(accountId, socket, npc.id);
    return;
  }

  switch (node.action.type) {
    case 'heal':
      // Heal is handled by map server (set HP/SP to max)
      // We just signal via a known pattern — map server checks after NPC handler returns
      log.info(`Heal action for account ${accountId}`);
      break;
    case 'save':
      log.info(`Save point set for account ${accountId} at ${npc.map}`);
      break;
    case 'warp':
      handleWarp(socket, {
        ...npc,
        warpTo: { map: node.action.map, x: node.action.x, y: node.action.y },
      });
      break;
    case 'storage':
      log.info(`Storage opened for account ${accountId}`);
      break;
    case 'close':
      break;
  }

  closeDialogue(accountId, socket, npc.id);
}

function closeDialogue(accountId: number, socket: Socket, npcId: number): void {
  dialogueStates.delete(accountId);
  const writer = new PacketWriter(6);
  writer.writeUInt16LE(PacketId.ZC_CLOSE_DIALOG);
  writer.writeUInt32LE(npcId);
  socket.write(writer.toBuffer());
}

/**
 * Send shop item list to client
 */
function sendShopList(socket: Socket, npc: NpcDef): void {
  if (!npc.shopItems || npc.shopItems.length === 0) return;

  const items: { itemId: number; price: number }[] = [];
  for (const si of npc.shopItems) {
    const def = getItemDef(si.itemId);
    if (!def) continue;
    items.push({ itemId: si.itemId, price: si.price ?? def.buy });
  }

  // ZC_PC_PURCHASE_ITEMLIST: [header 2][length 2] + [price 4][dcprice 4][type 1][itemId 2] * N
  const entrySize = 11;
  const totalLen = 4 + items.length * entrySize;
  const writer = new PacketWriter(totalLen);
  writer.writeUInt16LE(PacketId.ZC_PC_PURCHASE_ITEMLIST);
  writer.writeUInt16LE(totalLen);

  for (const item of items) {
    writer.writeUInt32LE(item.price);   // price
    writer.writeUInt32LE(item.price);   // discount price (same for now)
    writer.writeUInt8(0);               // item type
    writer.writeUInt16LE(item.itemId);  // item ID (nameid)
  }

  socket.write(writer.toBuffer());
  log.debug(`Sent shop list (${items.length} items) from NPC ${npc.name}`);
}

/**
 * Handle CZ_PC_PURCHASE_ITEMLIST (0x00c8): Player buys items from shop
 * Packet: [header 2][length 2] + [amount 2][itemId 2] * N
 */
export function handleShopBuy(
  accountId: number, charId: number, buffer: Buffer, socket: Socket,
): number {
  if (buffer.length < 4) return 0;
  const length = buffer.readUInt16LE(2);
  if (buffer.length < length) return 0;

  const entryCount = (length - 4) / 4;
  let offset = 4;
  let totalCost = 0;
  const purchases: { itemId: number; amount: number }[] = [];

  for (let i = 0; i < entryCount; i++) {
    const amount = buffer.readUInt16LE(offset); offset += 2;
    const itemId = buffer.readUInt16LE(offset); offset += 2;
    const def = getItemDef(itemId);
    if (!def) continue;
    totalCost += def.buy * amount;
    purchases.push({ itemId, amount });
  }

  // TODO: Check zeny (gold) balance when currency system is implemented
  let result = 0; // 0 = success
  for (const p of purchases) {
    const res = addItem(charId, p.itemId, p.amount);
    if (!res.success) { result = 1; break; }
  }

  const writer = new PacketWriter(5);
  writer.writeUInt16LE(PacketId.ZC_PC_PURCHASE_RESULT);
  writer.writeUInt8(result);
  socket.write(writer.toBuffer());

  log.info(`Shop buy: ${purchases.length} types, total cost ${totalCost}, result=${result}`);
  return length;
}
