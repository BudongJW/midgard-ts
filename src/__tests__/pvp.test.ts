import { describe, it, expect } from 'vitest';
import {
  isPvpMap, isGvgMap, canAttackPlayer, recordPvpKill,
  getPvpRanking, setPvpMap, PvpMode,
  startWoe, endWoe, isWoeActive, damageEmperium,
  getCastle, getAllCastles, investCastle,
} from '../map/pvp/pvp-manager.js';
import { createGuild } from '../map/guild/guild-manager.js';

describe('PvP System', () => {
  it('should detect PvP maps', () => {
    expect(isPvpMap('pvp_y_1-1')).toBe(true);
    expect(isPvpMap('prontera')).toBe(false);
  });

  it('should allow PvP attacks on PvP maps', () => {
    expect(canAttackPlayer('pvp_y_1-1', 1, undefined, 2, undefined)).toBe(true);
  });

  it('should not allow attacks on non-PvP maps', () => {
    expect(canAttackPlayer('prontera', 1, undefined, 2, undefined)).toBe(false);
  });

  it('should not allow self-attack', () => {
    expect(canAttackPlayer('pvp_y_1-1', 1, undefined, 1, undefined)).toBe(false);
  });

  it('should track PvP scores', () => {
    recordPvpKill('pvp_y_1-1', 1, 'Killer', 2, 'Victim');
    recordPvpKill('pvp_y_1-1', 1, 'Killer', 3, 'Victim2');
    const ranking = getPvpRanking('pvp_y_1-1');
    expect(ranking.length).toBeGreaterThan(0);
    expect(ranking[0].kills).toBe(2);
    expect(ranking[0].charName).toBe('Killer');
  });
});

describe('War of Emperium', () => {
  it('should have castles defined', () => {
    const castles = getAllCastles();
    expect(castles.length).toBeGreaterThan(5);
  });

  it('should start and end WoE', () => {
    expect(isWoeActive()).toBe(false);
    startWoe();
    expect(isWoeActive()).toBe(true);
    endWoe();
    expect(isWoeActive()).toBe(false);
  });

  it('should capture castle when emperium breaks', () => {
    const guild = createGuild('WoeGuild', 7001, 1, 'WoeMaster')!;
    startWoe();
    const castle = getCastle('prtg_cas01')!;
    // Deal enough damage to break
    const captured = damageEmperium('prtg_cas01', 999999, guild.id);
    expect(captured).toBe(true);
    expect(castle.ownerGuildId).toBe(guild.id);
    endWoe();
  });

  it('should not allow damaging own emperium', () => {
    const castle = getCastle('prtg_cas01')!;
    const ownerGuildId = castle.ownerGuildId!;
    startWoe();
    const result = damageEmperium('prtg_cas01', 1000, ownerGuildId);
    expect(result).toBe(false);
    endWoe();
  });
});
