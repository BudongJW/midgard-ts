/**
 * MidgardTS Skill Database
 * Basic skill definitions inspired by rAthena's skill_db.yml
 */

import { createLogger } from '../../common/logger/index.js';

const log = createLogger('SkillDB');

export enum SkillTarget {
  SELF = 0,
  ENEMY = 1,
  GROUND = 2,
  FRIEND = 3,
}

export enum SkillElement {
  NEUTRAL = 0, WATER = 1, EARTH = 2, FIRE = 3,
  WIND = 4, POISON = 5, HOLY = 6, DARK = 7,
}

export interface SkillDef {
  id: number;
  name: string;
  maxLv: number;
  target: SkillTarget;
  element: SkillElement;
  range: number;
  spCost: number[];        // SP cost per level (index 0 = lv1)
  castTime: number[];      // cast time ms per level
  cooldown: number[];      // cooldown ms per level
  damagePercent: number[];  // damage % per level (100 = 1x, 0 = non-damage skill)
  hitCount: number;
  description: string;
}

const SKILL_DB: Map<number, SkillDef> = new Map();

function reg(s: SkillDef): void {
  SKILL_DB.set(s.id, s);
}

// ======= First Class Basic Skills =======

// Swordman
reg({
  id: 5, name: 'Bash', maxLv: 10, target: SkillTarget.ENEMY, element: SkillElement.NEUTRAL,
  range: 1, hitCount: 1,
  spCost: [8, 8, 8, 8, 8, 15, 15, 15, 15, 15],
  castTime: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  cooldown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  damagePercent: [130, 160, 190, 220, 250, 280, 310, 340, 370, 400],
  description: 'Melee strike dealing up to 400% damage',
});

reg({
  id: 6, name: 'Provoke', maxLv: 10, target: SkillTarget.ENEMY, element: SkillElement.NEUTRAL,
  range: 9, hitCount: 0,
  spCost: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  castTime: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  cooldown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  damagePercent: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  description: 'Enrages target, lowering DEF but raising ATK',
});

reg({
  id: 7, name: 'Magnum Break', maxLv: 10, target: SkillTarget.SELF, element: SkillElement.FIRE,
  range: 0, hitCount: 1,
  spCost: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  castTime: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  cooldown: [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000],
  damagePercent: [120, 140, 160, 180, 200, 220, 240, 260, 280, 300],
  description: 'AoE fire attack around the user',
});

// Mage
reg({
  id: 13, name: 'Fire Bolt', maxLv: 10, target: SkillTarget.ENEMY, element: SkillElement.FIRE,
  range: 9, hitCount: 1,
  spCost: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
  castTime: [700, 1400, 2100, 2800, 3500, 3200, 2900, 2600, 2300, 2000],
  cooldown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  damagePercent: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  description: 'Launches fire bolts (1 bolt per level)',
});

reg({
  id: 14, name: 'Cold Bolt', maxLv: 10, target: SkillTarget.ENEMY, element: SkillElement.WATER,
  range: 9, hitCount: 1,
  spCost: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
  castTime: [700, 1400, 2100, 2800, 3500, 3200, 2900, 2600, 2300, 2000],
  cooldown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  damagePercent: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  description: 'Launches cold bolts (1 bolt per level)',
});

reg({
  id: 15, name: 'Lightning Bolt', maxLv: 10, target: SkillTarget.ENEMY, element: SkillElement.WIND,
  range: 9, hitCount: 1,
  spCost: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
  castTime: [700, 1400, 2100, 2800, 3500, 3200, 2900, 2600, 2300, 2000],
  cooldown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  damagePercent: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  description: 'Launches lightning bolts (1 bolt per level)',
});

reg({
  id: 19, name: 'Heal', maxLv: 10, target: SkillTarget.FRIEND, element: SkillElement.HOLY,
  range: 9, hitCount: 0,
  spCost: [13, 16, 19, 22, 25, 28, 31, 34, 37, 40],
  castTime: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  cooldown: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
  damagePercent: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  description: 'Restores HP to target (heal amount based on INT and skill level)',
});

// Archer
reg({
  id: 47, name: 'Double Strafe', maxLv: 10, target: SkillTarget.ENEMY, element: SkillElement.NEUTRAL,
  range: 9, hitCount: 2,
  spCost: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
  castTime: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  cooldown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  damagePercent: [100, 120, 140, 160, 180, 200, 220, 240, 260, 280],
  description: 'Two rapid shots dealing up to 280% per hit',
});

reg({
  id: 48, name: 'Arrow Shower', maxLv: 10, target: SkillTarget.GROUND, element: SkillElement.NEUTRAL,
  range: 9, hitCount: 1,
  spCost: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
  castTime: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  cooldown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  damagePercent: [75, 100, 125, 150, 175, 200, 225, 250, 275, 300],
  description: 'AoE arrow attack',
});

// Thief
reg({
  id: 136, name: 'Sonic Blow', maxLv: 10, target: SkillTarget.ENEMY, element: SkillElement.NEUTRAL,
  range: 1, hitCount: 8,
  spCost: [16, 18, 20, 22, 24, 26, 28, 30, 32, 34],
  castTime: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  cooldown: [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000],
  damagePercent: [50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
  description: '8-hit combo dealing massive damage',
});

// Basic universal skill
reg({
  id: 1, name: 'First Aid', maxLv: 1, target: SkillTarget.SELF, element: SkillElement.NEUTRAL,
  range: 0, hitCount: 0,
  spCost: [3],
  castTime: [0],
  cooldown: [0],
  damagePercent: [0],
  description: 'Restores 5 HP',
});

export function getSkillDef(id: number): SkillDef | undefined {
  return SKILL_DB.get(id);
}

export function getAllSkills(): SkillDef[] {
  return Array.from(SKILL_DB.values());
}

log.info(`Loaded ${SKILL_DB.size} skills`);
