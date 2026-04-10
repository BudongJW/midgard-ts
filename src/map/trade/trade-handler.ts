/**
 * MidgardTS Player-to-Player Trade System
 * Inspired by rAthena's trade.cpp
 */

import { getItemDef } from '../item/item-db.js';
import { loadInventory, removeItem, addItem, type InvItem } from '../item/inventory.js';
import { createLogger } from '../../common/logger/index.js';

const log = createLogger('Trade');

const MAX_TRADE_ITEMS = 10;

export interface TradeOffer {
  inventoryId: number;
  amount: number;
  itemId: number;
}

export interface TradeSession {
  accountId1: number;
  charId1: number;
  charName1: string;
  accountId2: number;
  charId2: number;
  charName2: string;
  items1: TradeOffer[];  // offered by player 1
  items2: TradeOffer[];  // offered by player 2
  zeny1: number;         // zeny offered by player 1
  zeny2: number;
  locked1: boolean;      // player 1 locked in
  locked2: boolean;
}

/** Pending trade requests: targetAccountId -> requesterAccountId */
const tradeRequests = new Map<number, number>();

/** Active trade sessions: accountId -> TradeSession */
const tradeSessions = new Map<number, TradeSession>();

/**
 * Player 1 requests trade with Player 2
 */
export function requestTrade(
  fromAccountId: number, fromCharId: number, fromName: string,
  toAccountId: number, toCharId: number, toName: string,
): boolean {
  if (tradeSessions.has(fromAccountId) || tradeSessions.has(toAccountId)) {
    log.debug('One of the players is already trading');
    return false;
  }
  if (tradeRequests.has(toAccountId)) {
    log.debug(`${toName} already has a pending trade request`);
    return false;
  }

  tradeRequests.set(toAccountId, fromAccountId);
  log.info(`${fromName} requests trade with ${toName}`);
  return true;
}

/**
 * Player 2 accepts the trade request
 */
export function acceptTrade(
  acceptorAccountId: number, acceptorCharId: number, acceptorName: string,
): TradeSession | null {
  const requesterId = tradeRequests.get(acceptorAccountId);
  if (requesterId === undefined) return null;
  tradeRequests.delete(acceptorAccountId);

  // We need the requester's charId/name — this would come from the map server's player state
  // For now, create with placeholder (the map server fills in real data)
  const session: TradeSession = {
    accountId1: requesterId,
    charId1: 0,        // filled by map server
    charName1: '',
    accountId2: acceptorAccountId,
    charId2: acceptorCharId,
    charName2: acceptorName,
    items1: [],
    items2: [],
    zeny1: 0,
    zeny2: 0,
    locked1: false,
    locked2: false,
  };

  tradeSessions.set(requesterId, session);
  tradeSessions.set(acceptorAccountId, session);

  log.info(`Trade session started between account ${requesterId} and ${acceptorName}`);
  return session;
}

/**
 * Decline or cancel a trade request
 */
export function declineTrade(accountId: number): boolean {
  // Check if there's a pending request targeting this account
  if (tradeRequests.has(accountId)) {
    tradeRequests.delete(accountId);
    return true;
  }
  // Check if we sent a request
  for (const [target, requester] of tradeRequests) {
    if (requester === accountId) {
      tradeRequests.delete(target);
      return true;
    }
  }
  return false;
}

/**
 * Add an item to the trade offer
 */
export function addTradeItem(
  accountId: number, inventoryId: number, amount: number,
): boolean {
  const session = tradeSessions.get(accountId);
  if (!session) return false;

  const isPlayer1 = session.accountId1 === accountId;
  const items = isPlayer1 ? session.items1 : session.items2;
  const locked = isPlayer1 ? session.locked1 : session.locked2;

  if (locked) return false; // already locked in
  if (items.length >= MAX_TRADE_ITEMS) return false;

  const charId = isPlayer1 ? session.charId1 : session.charId2;
  const inv = loadInventory(charId);
  const invItem = inv.find((i) => i.id === inventoryId);
  if (!invItem) return false;
  if (invItem.equip !== 0) return false;
  if (invItem.amount < amount) return false;

  // Check if same item already offered
  const existing = items.find((i) => i.inventoryId === inventoryId);
  if (existing) {
    if (existing.amount + amount > invItem.amount) return false;
    existing.amount += amount;
  } else {
    items.push({ inventoryId, amount, itemId: invItem.itemId });
  }

  // Unlock both sides when items change
  session.locked1 = false;
  session.locked2 = false;

  return true;
}

/**
 * Set zeny offer
 */
export function setTradeZeny(accountId: number, zeny: number): boolean {
  const session = tradeSessions.get(accountId);
  if (!session) return false;
  if (zeny < 0 || zeny > 1_000_000_000) return false;

  if (session.accountId1 === accountId) {
    session.zeny1 = zeny;
  } else {
    session.zeny2 = zeny;
  }

  session.locked1 = false;
  session.locked2 = false;
  return true;
}

/**
 * Lock in (confirm) the trade offer
 */
export function lockTrade(accountId: number): boolean {
  const session = tradeSessions.get(accountId);
  if (!session) return false;

  if (session.accountId1 === accountId) {
    session.locked1 = true;
  } else {
    session.locked2 = true;
  }

  // If both locked, execute trade
  if (session.locked1 && session.locked2) {
    return executeTrade(session);
  }

  return true;
}

/**
 * Cancel an active trade session
 */
export function cancelTrade(accountId: number): boolean {
  const session = tradeSessions.get(accountId);
  if (!session) return false;

  tradeSessions.delete(session.accountId1);
  tradeSessions.delete(session.accountId2);

  log.info(`Trade cancelled between ${session.charName1} and ${session.charName2}`);
  return true;
}

function executeTrade(session: TradeSession): boolean {
  // Validate all items still exist and amounts are correct
  for (const offer of session.items1) {
    const inv = loadInventory(session.charId1);
    const item = inv.find((i) => i.id === offer.inventoryId);
    if (!item || item.amount < offer.amount) {
      cancelTrade(session.accountId1);
      return false;
    }
  }
  for (const offer of session.items2) {
    const inv = loadInventory(session.charId2);
    const item = inv.find((i) => i.id === offer.inventoryId);
    if (!item || item.amount < offer.amount) {
      cancelTrade(session.accountId1);
      return false;
    }
  }

  // TODO: Validate zeny balances

  // Transfer items: Player 1 -> Player 2
  for (const offer of session.items1) {
    removeItem(session.charId1, offer.inventoryId, offer.amount);
    addItem(session.charId2, offer.itemId, offer.amount);
  }

  // Transfer items: Player 2 -> Player 1
  for (const offer of session.items2) {
    removeItem(session.charId2, offer.inventoryId, offer.amount);
    addItem(session.charId1, offer.itemId, offer.amount);
  }

  // TODO: Transfer zeny

  tradeSessions.delete(session.accountId1);
  tradeSessions.delete(session.accountId2);

  log.info(`Trade completed: ${session.charName1} <-> ${session.charName2}`);
  return true;
}

/**
 * Get active trade session for an account
 */
export function getTradeSession(accountId: number): TradeSession | undefined {
  return tradeSessions.get(accountId);
}

/**
 * Check if account is currently trading
 */
export function isTrading(accountId: number): boolean {
  return tradeSessions.has(accountId);
}
