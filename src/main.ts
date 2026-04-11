/**
 * MidgardTS — Ragnarok Online Server Emulator
 * Inspired by rAthena, Hercules, and rust-ro
 *
 * Architecture: 3-server model (Login / Char / Map)
 * - Login Server (default :6900) — Account authentication
 * - Char Server  (default :6121) — Character management
 * - Map Server   (default :5121) — Game world simulation
 */

import { loadConfig } from './common/config/index.js';
import { createLogger, setLogLevel, LogLevel } from './common/logger/index.js';
import { initDatabase, closeDatabase } from './common/database/index.js';
import { LoginServer } from './login/server.js';
import { CharServer } from './char/server.js';
import { MapServer } from './map/server.js';

const log = createLogger('Main');

function showBanner(): void {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║          MidgardTS  v0.1.0               ║
  ║   Ragnarok Online Server Emulator        ║
  ║                                          ║
  ║   Inspired by rAthena & Hercules         ║
  ╚══════════════════════════════════════════╝
  `);
}

async function main(): Promise<void> {
  showBanner();

  // Parse CLI args
  const args = process.argv.slice(2);
  const configPath = args.find((a) => a.startsWith('--config='))?.split('=')[1];

  if (args.includes('--debug')) {
    setLogLevel(LogLevel.DEBUG);
  }

  // Load configuration
  const config = loadConfig(configPath);

  // Initialize database (async — sql.js needs WASM init)
  await initDatabase(config.database.path);

  // Start servers — fail fast if any port is unavailable
  const loginServer = new LoginServer(config);
  const charServer = new CharServer(config);
  const mapServer = new MapServer(config);

  await loginServer.start();
  await charServer.start();
  await mapServer.start();

  log.status('All servers started successfully');
  log.info(`Login: ${config.login.host}:${config.login.port}`);
  log.info(`Char:  ${config.char.host}:${config.char.port}`);
  log.info(`Map:   ${config.map.host}:${config.map.port}`);
  log.info(`Rates: Base ${config.map.baseExpRate}% / Job ${config.map.jobExpRate}% / Drop ${config.map.dropRate}%`);

  // Graceful shutdown
  const shutdown = () => {
    log.status('Shutting down...');
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
