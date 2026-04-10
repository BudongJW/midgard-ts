import { describe, it, expect } from 'vitest';
import {
  createGuild, addGuildMember, removeGuildMember,
  getGuildByAccount, donateGuildExp, setGuildNotice,
  addAlliance, addEnemy, setPositionInfo, setMemberPosition,
} from '../map/guild/guild-manager.js';

describe('GuildManager', () => {
  it('should create a guild', () => {
    const guild = createGuild('TestGuild', 5001, 1, 'GuildMaster');
    expect(guild).not.toBeNull();
    expect(guild!.name).toBe('TestGuild');
    expect(guild!.level).toBe(1);
    expect(guild!.members.length).toBe(1);
    expect(guild!.members[0].positionIdx).toBe(0);
  });

  it('should reject duplicate guild names', () => {
    const dup = createGuild('TestGuild', 5099, 99, 'Other');
    expect(dup).toBeNull();
  });

  it('should add members', () => {
    const guild = getGuildByAccount(5001)!;
    expect(addGuildMember(guild.id, 5002, 2, 'Member1')).toBe(true);
    expect(addGuildMember(guild.id, 5003, 3, 'Member2')).toBe(true);
    expect(guild.members.length).toBe(3);
  });

  it('should donate EXP to guild', () => {
    const guild = getGuildByAccount(5002)!;
    // Set position 1 to have 10% tax
    setPositionInfo(guild.id, 5001, 1, 'Taxed Member', 0, 10);
    const taxed = donateGuildExp(5002, 1000);
    expect(taxed).toBe(100); // 10% of 1000
    expect(guild.exp).toBe(100);
  });

  it('should set guild notice (master only)', () => {
    expect(setGuildNotice(5001, 'Hello guild!')).toBe(true);
    expect(setGuildNotice(5002, 'Nope')).toBe(false); // not master
    const guild = getGuildByAccount(5001)!;
    expect(guild.notice).toBe('Hello guild!');
  });

  it('should handle alliances and enemies', () => {
    const guild2 = createGuild('AllyGuild', 5010, 10, 'AllyLeader')!;
    const guild1 = getGuildByAccount(5001)!;

    expect(addAlliance(guild1.id, guild2.id)).toBe(true);
    expect(guild1.allies).toContain(guild2.id);
    expect(guild2.allies).toContain(guild1.id);

    const guild3 = createGuild('EnemyGuild', 5020, 20, 'EnemyLeader')!;
    expect(addEnemy(guild1.id, guild3.id)).toBe(true);
    expect(guild1.enemies).toContain(guild3.id);
  });

  it('should remove member', () => {
    const guild = getGuildByAccount(5001)!;
    const prevLen = guild.members.length;
    expect(removeGuildMember(5003)).toBe(true);
    expect(guild.members.length).toBe(prevLen - 1);
  });

  it('should disband when master leaves', () => {
    // Remove remaining non-master member first
    removeGuildMember(5002);
    expect(removeGuildMember(5001)).toBe(true);
    expect(getGuildByAccount(5001)).toBeUndefined();
  });
});
