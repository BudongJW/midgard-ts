/**
 * MidgardTS Map Server
 * Handles in-game actions: movement, chat, combat
 * Inspired by rAthena map-server
 */

import { createServer, type Socket } from 'node:net';
import { PacketReader, PacketWriter, PacketId } from '../common/packet/index.js';
import { createLogger } from '../common/logger/index.js';
import { execute, queryOne } from '../common/database/index.js';
import { SessionManager, type Session } from '../common/net/session.js';
import { authStore } from '../common/net/auth-store.js';
import type { ServerConfig } from '../common/config/index.js';

const log = createLogger('Map');

interface PlayerState {
  charId: number;
  charName: string;
  mapName: string;
  x: number;
  y: number;
  dir: number;
  speed: number;
  baseLevel: number;
  jobLevel: number;
}

const MAX_CHAT_LENGTH = 255;
const CONNECTION_TIMEOUT_MS = 120_000; // 2 min idle timeout

export class MapServer {
  private sessions = new SessionManager();
  private players = new Map<number, PlayerState>();
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  start(): void {
    const server = createServer((socket) => this.onConnection(socket));
    const { host, port } = this.config.map;

    server.listen(port, host, () => {
      log.status(`Map server listening on ${host}:${port}`);
    });

    server.on('error', (err) => {
      log.fatal(`Map server error: ${err.message}`);
    });
  }

  private onConnection(socket: Socket): void {
    const session = this.sessions.create(socket);
    log.info(`New connection from ${session.ip}`);

    socket.setTimeout(CONNECTION_TIMEOUT_MS, () => {
      log.info(`Connection timeout for ${session.ip}`);
      this.onDisconnect(session);
      socket.destroy();
    });

    let packetBuffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      packetBuffer = Buffer.concat([packetBuffer, data]);

      while (packetBuffer.length >= 2) {
        const packetId = packetBuffer.readUInt16LE(0);
        const consumed = this.handlePacket(session, packetId, packetBuffer);
        if (consumed <= 0) break;
        packetBuffer = packetBuffer.subarray(consumed);
      }
    });

    socket.on('close', () => {
      this.onDisconnect(session);
    });

    socket.on('error', (err) => {
      log.warn(`Socket error from ${session.ip}: ${err.message}`);
      this.onDisconnect(session);
    });
  }

  private onDisconnect(session: Session): void {
    const player = this.players.get(session.accountId);
    if (player) {
      execute('UPDATE characters SET last_map = ?, last_x = ?, last_y = ? WHERE id = ?', [
        player.mapName, player.x, player.y, player.charId,
      ]);
      this.players.delete(session.accountId);
      log.info(`Player ${player.charName} disconnected, position saved`);
    }
    this.sessions.remove(session.socket);
  }

  private handlePacket(session: Session, packetId: number, buffer: Buffer): number {
    switch (packetId) {
      case PacketId.CZ_ENTER:
        return this.handleMapEnter(session, buffer);
      case PacketId.CZ_REQUEST_MOVE:
        return this.handleMoveRequest(session, buffer);
      case PacketId.CZ_REQUEST_CHAT:
        return this.handleChat(session, buffer);
      case PacketId.CZ_REQUEST_TIME:
        return this.handleKeepAlive(session, buffer);
      default:
        // Unknown packets: skip 2 bytes (header) to attempt recovery
        // In production, a packet length table should be used
        log.debug(`Unhandled packet 0x${packetId.toString(16).padStart(4, '0')} from ${session.ip}`);
        return 2;
    }
  }

  /**
   * CZ_ENTER (0x0436): Client enters map
   * Total: 19 bytes
   */
  private handleMapEnter(session: Session, buffer: Buffer): number {
    const PACKET_LEN = 19;
    if (buffer.length < PACKET_LEN) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE();
    session.accountId = reader.readUInt32LE();
    const charId = reader.readUInt32LE();
    session.loginId1 = reader.readUInt32LE();
    const clientTick = reader.readUInt32LE();
    session.sex = reader.readUInt8();

    // Validate session from char server
    if (!authStore.validate(session.accountId, session.loginId1, session.loginId2)) {
      log.warn(`Auth failed for account ${session.accountId} from ${session.ip}`);
      session.socket.destroy();
      return PACKET_LEN;
    }
    authStore.consume(session.accountId);

    const char = queryOne<{
      id: number; name: string; last_map: string; last_x: number; last_y: number;
      base_level: number; job_level: number;
    }>(
      'SELECT id, name, last_map, last_x, last_y, base_level, job_level FROM characters WHERE id = ? AND account_id = ?',
      [charId, session.accountId],
    );

    if (!char) {
      log.warn(`Invalid map enter: char ${charId} not found for account ${session.accountId}`);
      return PACKET_LEN;
    }

    const state: PlayerState = {
      charId: char.id,
      charName: char.name,
      mapName: char.last_map,
      x: char.last_x,
      y: char.last_y,
      dir: 0,
      speed: 150,
      baseLevel: char.base_level,
      jobLevel: char.job_level,
    };
    this.players.set(session.accountId, state);

    this.sendMapAccept(session, state, clientTick);
    log.status(`Player ${char.name} entered map ${char.last_map} (${char.last_x},${char.last_y})`);
    return PACKET_LEN;
  }

  private sendMapAccept(session: Session, state: PlayerState, clientTick: number): void {
    const writer = new PacketWriter(11);
    writer.writeUInt16LE(PacketId.ZC_ACCEPT_ENTER);
    writer.writeUInt32LE(clientTick);

    const posData = this.encodePosition(state.x, state.y, state.dir);
    writer.writeUInt8(posData[0]);
    writer.writeUInt8(posData[1]);
    writer.writeUInt8(posData[2]);
    writer.writeUInt8(5);
    writer.writeUInt8(5);

    session.socket.write(writer.toBuffer());
  }

  /**
   * CZ_REQUEST_MOVE (0x0085): Movement request
   * Total: 5 bytes
   */
  private handleMoveRequest(session: Session, buffer: Buffer): number {
    const PACKET_LEN = 5;
    if (buffer.length < PACKET_LEN) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE();

    const b0 = reader.readUInt8();
    const b1 = reader.readUInt8();
    const b2 = reader.readUInt8();

    // Decode WBUFPOS: x = 10 bits, y = 10 bits, dir = 4 bits
    const destX = (b0 << 2) | ((b1 >> 6) & 0x03);
    const destY = ((b1 & 0x3F) << 4) | ((b2 >> 4) & 0x0F);
    const dir = b2 & 0x0F;

    const player = this.players.get(session.accountId);
    if (!player) return PACKET_LEN;

    const fromX = player.x;
    const fromY = player.y;
    player.x = destX;
    player.y = destY;
    player.dir = dir;

    const writer = new PacketWriter(12);
    writer.writeUInt16LE(PacketId.ZC_NOTIFY_PLAYERMOVE);
    writer.writeUInt32LE(Date.now() & 0xFFFFFFFF);

    const moveData = this.encodeMovePosition(fromX, fromY, destX, destY);
    for (const byte of moveData) writer.writeUInt8(byte);

    session.socket.write(writer.toBuffer());
    log.debug(`Player ${player.charName} moved to (${destX},${destY})`);
    return PACKET_LEN;
  }

  /**
   * CZ_REQUEST_CHAT (0x008c): Chat message
   */
  private handleChat(session: Session, buffer: Buffer): number {
    if (buffer.length < 4) return 0;
    const length = buffer.readUInt16LE(2);
    if (length < 4 || length > MAX_CHAT_LENGTH + 4) {
      log.warn(`Invalid chat length ${length} from ${session.ip}`);
      return Math.max(length, 4); // consume and discard
    }
    if (buffer.length < length) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE();
    reader.readUInt16LE();
    const message = reader.readString(length - 4);

    const player = this.players.get(session.accountId);
    if (!player) return length;

    log.info(`[Chat] ${player.charName}: ${message}`);

    const fullMessage = `${player.charName} : ${message}`;
    const msgBytes = Buffer.from(fullMessage, 'ascii');
    const totalLen = 4 + msgBytes.length + 1;

    const writer = new PacketWriter(totalLen + 4);
    writer.writeUInt16LE(PacketId.ZC_NOTIFY_CHAT);
    writer.writeUInt16LE(totalLen);
    writer.writeBytes(msgBytes);
    writer.writeUInt8(0);

    session.socket.write(writer.toBuffer());
    return length;
  }

  /**
   * Encode (x, y, dir) into 3 bytes — rAthena WBUFPOS format
   * x = 10 bits, y = 10 bits, dir = 4 bits = 24 bits = 3 bytes
   */
  private encodePosition(x: number, y: number, dir: number): [number, number, number] {
    return [
      (x >> 2) & 0xFF,
      (((x & 0x03) << 6) | ((y >> 4) & 0x3F)) & 0xFF,
      (((y & 0x0F) << 4) | (dir & 0x0F)) & 0xFF,
    ];
  }

  /**
   * Encode movement (x0,y0 -> x1,y1) into 6 bytes — rAthena WBUFPOS2 format
   * x0 = 10 bits, y0 = 10 bits, x1 = 10 bits, y1 = 10 bits, sx = 4 bits, sy = 4 bits
   */
  private encodeMovePosition(x0: number, y0: number, x1: number, y1: number): number[] {
    return [
      (x0 >> 2) & 0xFF,
      (((x0 & 0x03) << 6) | ((y0 >> 4) & 0x3F)) & 0xFF,
      (((y0 & 0x0F) << 4) | ((x1 >> 6) & 0x0F)) & 0xFF,
      (((x1 & 0x3F) << 2) | ((y1 >> 8) & 0x03)) & 0xFF,
      y1 & 0xFF,
      ((8 << 4) | 8) & 0xFF, // sx=8, sy=8 (center of cell)
    ];
  }

  private handleKeepAlive(session: Session, buffer: Buffer): number {
    if (buffer.length < 6) return 0;
    const reader = new PacketReader(buffer);
    reader.readUInt16LE();
    const clientTick = reader.readUInt32LE();

    const writer = new PacketWriter(6);
    writer.writeUInt16LE(PacketId.ZC_NOTIFY_TIME);
    writer.writeUInt32LE(clientTick);
    session.socket.write(writer.toBuffer());
    return 6;
  }
}
