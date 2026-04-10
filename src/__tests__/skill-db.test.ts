import { describe, it, expect } from 'vitest';
import { getSkillDef, getAllSkills, SkillTarget, SkillElement } from '../map/skill/skill-db.js';

describe('SkillDB', () => {
  it('should have skills loaded', () => {
    const all = getAllSkills();
    expect(all.length).toBeGreaterThan(5);
  });

  it('should find Bash by id', () => {
    const bash = getSkillDef(5);
    expect(bash).toBeDefined();
    expect(bash!.name).toBe('Bash');
    expect(bash!.maxLv).toBe(10);
    expect(bash!.target).toBe(SkillTarget.ENEMY);
  });

  it('should have correct SP cost array length', () => {
    const bash = getSkillDef(5);
    expect(bash!.spCost.length).toBe(bash!.maxLv);
    expect(bash!.damagePercent.length).toBe(bash!.maxLv);
  });

  it('should find Heal as support skill', () => {
    const heal = getSkillDef(19);
    expect(heal).toBeDefined();
    expect(heal!.name).toBe('Heal');
    expect(heal!.target).toBe(SkillTarget.FRIEND);
    expect(heal!.element).toBe(SkillElement.HOLY);
    expect(heal!.damagePercent[0]).toBe(0); // non-damage
  });

  it('should have damage scaling per level', () => {
    const fireBolt = getSkillDef(13);
    expect(fireBolt).toBeDefined();
    for (let i = 1; i < fireBolt!.maxLv; i++) {
      expect(fireBolt!.damagePercent[i]).toBeGreaterThan(fireBolt!.damagePercent[i - 1]);
    }
  });
});
