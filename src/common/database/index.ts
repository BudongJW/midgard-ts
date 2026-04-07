/**
 * MidgardTS Database Layer
 * SQLite-based storage inspired by rAthena's SQL tables
 * Uses sql.js (pure JS, no native compilation needed)
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createLogger } from '../logger/index.js';

const log = createLogger('Database');

let db: SqlJsDatabase | null = null;
let dbPath: string = '';
let saveTimer: ReturnType<typeof setInterval> | null = null;

export async function initDatabase(path: string): Promise<SqlJsDatabase> {
  dbPath = path;

  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (existsSync(path)) {
    const fileBuffer = readFileSync(path);
    db = new SQL.Database(fileBuffer);
    log.info('Loaded existing database');
  } else {
    db = new SQL.Database();
    log.info('Created new database');
  }

  db.run('PRAGMA foreign_keys = ON');
  createTables(db);

  // Auto-save every 30 seconds
  saveTimer = setInterval(() => saveDatabase(), 30000);

  log.status(`Database initialized at ${path}`);
  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function saveDatabase(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

/** Convenience: run a query and return all rows as objects */
export function queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  try {
    if (params) stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } catch (err) {
    log.error(`Query failed: ${sql} — ${err}`);
    return [];
  } finally {
    stmt.free();
  }
}

/** Convenience: run a query and return the first row */
export function queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
  const rows = queryAll<T>(sql, params);
  return rows[0];
}

/** Convenience: run an INSERT/UPDATE/DELETE and return changes info */
export function execute(sql: string, params?: unknown[]): { lastId: number; success: boolean } {
  const d = getDb();
  try {
    d.run(sql, params);
    const lastId = (queryOne<{ id: number }>('SELECT last_insert_rowid() as id') ?? { id: 0 }).id;
    return { lastId, success: true };
  } catch (err) {
    log.error(`Execute failed: ${sql} — ${err}`);
    return { lastId: 0, success: false };
  }
}

function createTables(db: SqlJsDatabase): void {
  db.run(`
    -- Accounts (login_db equivalent in rAthena)
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT DEFAULT '',
      group_id INTEGER DEFAULT 0,
      state INTEGER DEFAULT 0,
      login_count INTEGER DEFAULT 0,
      last_login TEXT DEFAULT '',
      last_ip TEXT DEFAULT '',
      birthdate TEXT DEFAULT '',
      pincode TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Characters (char_db equivalent)
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      slot INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL UNIQUE,
      class INTEGER DEFAULT 0,
      base_level INTEGER DEFAULT 1,
      job_level INTEGER DEFAULT 1,
      base_exp INTEGER DEFAULT 0,
      job_exp INTEGER DEFAULT 0,
      zeny INTEGER DEFAULT 0,
      str INTEGER DEFAULT 1,
      agi INTEGER DEFAULT 1,
      vit INTEGER DEFAULT 1,
      int_ INTEGER DEFAULT 1,
      dex INTEGER DEFAULT 1,
      luk INTEGER DEFAULT 1,
      max_hp INTEGER DEFAULT 40,
      hp INTEGER DEFAULT 40,
      max_sp INTEGER DEFAULT 11,
      sp INTEGER DEFAULT 11,
      status_point INTEGER DEFAULT 48,
      skill_point INTEGER DEFAULT 0,
      hair INTEGER DEFAULT 0,
      hair_color INTEGER DEFAULT 0,
      clothes_color INTEGER DEFAULT 0,
      body INTEGER DEFAULT 0,
      weapon INTEGER DEFAULT 0,
      shield INTEGER DEFAULT 0,
      head_top INTEGER DEFAULT 0,
      head_mid INTEGER DEFAULT 0,
      head_bottom INTEGER DEFAULT 0,
      last_map TEXT DEFAULT 'new_1-1',
      last_x INTEGER DEFAULT 53,
      last_y INTEGER DEFAULT 111,
      save_map TEXT DEFAULT 'new_1-1',
      save_x INTEGER DEFAULT 53,
      save_y INTEGER DEFAULT 111,
      sex TEXT DEFAULT 'U',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      UNIQUE(account_id, slot)
    );

    -- Inventory (inventory_db equivalent)
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      char_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      amount INTEGER DEFAULT 1,
      equip INTEGER DEFAULT 0,
      identify INTEGER DEFAULT 1,
      refine INTEGER DEFAULT 0,
      card0 INTEGER DEFAULT 0,
      card1 INTEGER DEFAULT 0,
      card2 INTEGER DEFAULT 0,
      card3 INTEGER DEFAULT 0,
      FOREIGN KEY (char_id) REFERENCES characters(id)
    );

    -- Login log
    CREATE TABLE IF NOT EXISTS login_log (
      time TEXT DEFAULT (datetime('now')),
      ip TEXT,
      user_id TEXT,
      result TEXT
    );
  `);

  log.info('Database tables verified');
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    log.info('Database saved and closed');
  }
}
