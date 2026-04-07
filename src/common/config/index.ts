/**
 * MidgardTS Configuration
 * YAML-based config inspired by rAthena's conf system
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createLogger } from '../logger/index.js';

const log = createLogger('Config');

export interface ServerConfig {
  login: {
    host: string;
    port: number;
    newAccountAllowed: boolean;
  };
  char: {
    host: string;
    port: number;
    maxSlots: number;
    startZeny: number;
    startMap: string;
    startX: number;
    startY: number;
  };
  map: {
    host: string;
    port: number;
    maxBaseLevel: number;
    maxJobLevel: number;
    baseExpRate: number;
    jobExpRate: number;
    dropRate: number;
  };
  database: {
    path: string;
  };
  network: {
    packetVersion: number;
  };
}

const DEFAULT_CONFIG: ServerConfig = {
  login: {
    host: '0.0.0.0',
    port: 6900,
    newAccountAllowed: true,
  },
  char: {
    host: '0.0.0.0',
    port: 6121,
    maxSlots: 9,
    startZeny: 0,
    startMap: 'new_1-1',
    startX: 53,
    startY: 111,
  },
  map: {
    host: '0.0.0.0',
    port: 5121,
    maxBaseLevel: 99,
    maxJobLevel: 50,
    baseExpRate: 100,
    jobExpRate: 100,
    dropRate: 100,
  },
  database: {
    path: './data/midgard.db',
  },
  network: {
    packetVersion: 20211103,
  },
};

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(
        (result[key] ?? {}) as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[typeof key];
    } else if (val !== undefined) {
      result[key] = val as T[typeof key];
    }
  }
  return result;
}

export function loadConfig(configPath?: string): ServerConfig {
  const path = configPath ?? resolve(process.cwd(), 'config.yaml');

  if (!existsSync(path)) {
    log.warn(`Config file not found at ${path}, using defaults`);
    return DEFAULT_CONFIG;
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = parseYaml(raw) as Partial<ServerConfig>;
    const merged = deepMerge(DEFAULT_CONFIG, parsed);
    log.status(`Configuration loaded from ${path}`);
    return merged;
  } catch (err) {
    log.error(`Failed to parse config: ${err}`);
    return DEFAULT_CONFIG;
  }
}
