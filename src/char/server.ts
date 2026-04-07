/**
 * MidgardTS Character Server
 * Handles character selection, creation, deletion
 * Inspired by rAthena char-server
 */

import { createServer, type Socket } from 'node:net';
import { PacketReader, PacketWriter, PacketId } from '../common/packet/index.js';
import { createLogger } from '../common/logger/index.js';
import { queryAll, queryOne, execute } from '../common/database/index.js';
import { SessionManager, type Session } from '../common/net/session.js';
import type { ServerConfig } from '../common/config/index.js';

const log = createLogger('Char');

interface CharRow {
  id: number;
  slot: number;
  name: string;
  class: number;
  base_level: number;
  job_level: number;
  base_exp: number;
  job_exp: number;
  zeny: number;
  str: number;
  agi: number;
  vit: number;
  int_: number;
  dex: number;
  luk: number;
  max_hp: number;
  hp: number;
  max_sp: number;
  sp: number;
  status_point: number;
  skill_point: number;
  hair: number;
  hair_color: number;
  clothes_color: number;
  body: number;
  weapon: number;
  shield: number;
  head_top: number;
  head_mid: number;
  head_bottom: number;
  last_map: string;
  last_x: number;
  last_y: number;
  sex: string;
}

export class CharServer {
  private sessions = new SessionManager();
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  start(): void {
    const server = createServer((socket) => this.onConnection(socket));
    const { host, port } = this.config.char;

    server.listen(port, host, () => {
      log.status(`Char server listening on ${host}:${port}`);
    });

    server.on('error', (err) => {
      log.fatal(`Char server error: ${err.message}`);
    });
  }

  private onConnection(socket: Socket): void {
    const session = this.sessions.create(socket);
    log.info(`New connection from ${session.ip}`);

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
      log.info(`Connection closed: ${session.ip}`);
      this.sessions.remove(socket);
    });

    socket.on('error', (err) => {
      log.warn(`Socket error from ${session.ip}: ${err.message}`);
      this.sessions.remove(socket);
    });
  }

  private handlePacket(session: Session, packetId: number, buffer: Buffer): number {
    switch (packetId) {
      case PacketId.CH_ENTER:
        return this.handleCharEnter(session, buffer);
      case PacketId.CH_SELECT_CHAR:
        return this.handleSelectChar(session, buffer);
      case PacketId.CH_MAKE_CHAR:
        return this.handleMakeChar(session, buffer);
      case PacketId.CH_DELETE_CHAR:
        return this.handleDeleteChar(session, buffer);
      case PacketId.CZ_REQUEST_TIME:
        return this.handleKeepAlive(session, buffer);
      default:
        log.warn(`Unknown packet 0x${packetId.toString(16).padStart(4, '0')} from ${session.ip}`);
        return buffer.length;
    }
  }

  /**
   * CH_ENTER (0x0065): Enter character select screen
   * Total: 17 bytes
   */
  private handleCharEnter(session: Session, buffer: Buffer): number {
    const PACKET_LEN = 17;
    if (buffer.length < PACKET_LEN) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE();
    session.accountId = reader.readUInt32LE();
    session.loginId1 = reader.readUInt32LE();
    session.loginId2 = reader.readUInt32LE();

    log.info(`Char enter for account ${session.accountId}`);
    this.sendCharList(session);
    return PACKET_LEN;
  }

  private sendCharList(session: Session): void {
    const chars = queryAll<CharRow>(
      'SELECT * FROM characters WHERE account_id = ? ORDER BY slot',
      [session.accountId],
    );

    const CHAR_ENTRY_SIZE = 155;
    const headerSize = 4;
    const totalSize = headerSize + chars.length * CHAR_ENTRY_SIZE;

    const writer = new PacketWriter(totalSize + 20);
    writer.writeUInt16LE(PacketId.HC_ACCEPT_ENTER);
    writer.writeUInt16LE(totalSize);

    for (const char of chars) {
      this.writeCharEntry(writer, char);
    }

    session.socket.write(writer.toBuffer());
    log.info(`Sent ${chars.length} characters to account ${session.accountId}`);
  }

  private writeCharEntry(writer: PacketWriter, char: CharRow): void {
    writer.writeUInt32LE(char.id);
    writer.writeUInt32LE(char.base_exp);
    writer.writeUInt32LE(char.zeny);
    writer.writeUInt32LE(char.job_exp);
    writer.writeUInt32LE(0); // job level padding
    writer.writeUInt32LE(0); // option
    writer.writeUInt32LE(0); // karma
    writer.writeUInt32LE(0); // manner
    writer.writeUInt16LE(char.status_point ?? 48);
    writer.writeUInt16LE(char.hp);
    writer.writeUInt16LE(char.max_hp);
    writer.writeUInt16LE(char.sp);
    writer.writeUInt16LE(char.max_sp);
    writer.writeUInt16LE(150); // speed
    writer.writeUInt16LE(char.class);
    writer.writeUInt16LE(char.hair);
    writer.writeUInt16LE(0); // body2
    writer.writeUInt16LE(char.weapon);
    writer.writeUInt16LE(char.base_level);
    writer.writeUInt16LE(char.skill_point ?? 0);
    writer.writeUInt16LE(char.head_bottom);
    writer.writeUInt16LE(char.shield);
    writer.writeUInt16LE(char.head_top);
    writer.writeUInt16LE(char.head_mid);
    writer.writeUInt16LE(char.hair_color);
    writer.writeUInt16LE(char.clothes_color);
    writer.writeString(char.name, 24);
    writer.writeUInt8(char.str);
    writer.writeUInt8(char.agi);
    writer.writeUInt8(char.vit);
    writer.writeUInt8(char.int_);
    writer.writeUInt8(char.dex);
    writer.writeUInt8(char.luk);
    writer.writeUInt16LE(char.slot);
    writer.writeUInt16LE(0); // rename
    writer.writeString(char.last_map + '.gat', 16);
    writer.writeUInt32LE(0); // delete date
    writer.writeUInt32LE(0); // robe
    writer.writeUInt32LE(0); // slot change
    writer.writeUInt32LE(0); // rename addon
    writer.writeUInt8(char.sex === 'M' ? 1 : 0);
  }

  /**
   * CH_SELECT_CHAR (0x0066): Select character
   */
  private handleSelectChar(session: Session, buffer: Buffer): number {
    const PACKET_LEN = 3;
    if (buffer.length < PACKET_LEN) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE();
    const slot = reader.readUInt8();

    const char = queryOne<CharRow>(
      'SELECT * FROM characters WHERE account_id = ? AND slot = ?',
      [session.accountId, slot],
    );

    if (!char) {
      log.warn(`Character not found in slot ${slot} for account ${session.accountId}`);
      return PACKET_LEN;
    }

    this.sendMapServerInfo(session, char);
    return PACKET_LEN;
  }

  private sendMapServerInfo(session: Session, char: CharRow): void {
    const mapHost = this.config.map.host === '0.0.0.0' ? '127.0.0.1' : this.config.map.host;
    const ipParts = mapHost.split('.').map(Number);

    const writer = new PacketWriter(28);
    writer.writeUInt16LE(PacketId.HC_NOTIFY_ZONESVR);
    writer.writeUInt32LE(char.id);
    writer.writeString(char.last_map + '.gat', 16);
    writer.writeUInt8(ipParts[0] ?? 127);
    writer.writeUInt8(ipParts[1] ?? 0);
    writer.writeUInt8(ipParts[2] ?? 0);
    writer.writeUInt8(ipParts[3] ?? 1);
    writer.writeUInt16LE(this.config.map.port);

    session.socket.write(writer.toBuffer());
    log.status(`Character ${char.name} selected, redirecting to map server`);
  }

  /**
   * CH_MAKE_CHAR (0x0067): Create new character
   */
  private handleMakeChar(session: Session, buffer: Buffer): number {
    const PACKET_LEN = 37;
    if (buffer.length < PACKET_LEN) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE();
    const name = reader.readString(24);
    const str = reader.readUInt8();
    const agi = reader.readUInt8();
    const vit = reader.readUInt8();
    const int_ = reader.readUInt8();
    const dex = reader.readUInt8();
    const luk = reader.readUInt8();
    const slot = reader.readUInt8();
    const hairColor = reader.readUInt16LE();
    const hair = reader.readUInt16LE();

    const statTotal = str + agi + vit + int_ + dex + luk;
    if (statTotal > 6 + 48) {
      log.warn(`Invalid stats total ${statTotal} from account ${session.accountId}`);
      return PACKET_LEN;
    }

    if (slot >= this.config.char.maxSlots) {
      log.warn(`Invalid slot ${slot} from account ${session.accountId}`);
      return PACKET_LEN;
    }

    try {
      const { lastId } = execute(
        `INSERT INTO characters (account_id, slot, name, str, agi, vit, int_, dex, luk, hair, hair_color, zeny, last_map, last_x, last_y, save_map, save_x, save_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.accountId, slot, name, str, agi, vit, int_, dex, luk, hair, hairColor,
          this.config.char.startZeny,
          this.config.char.startMap, this.config.char.startX, this.config.char.startY,
          this.config.char.startMap, this.config.char.startX, this.config.char.startY,
        ],
      );

      const char = queryOne<CharRow>('SELECT * FROM characters WHERE id = ?', [lastId]);
      if (char) {
        const writer = new PacketWriter(160);
        writer.writeUInt16LE(PacketId.HC_ACCEPT_MAKECHAR);
        this.writeCharEntry(writer, char);
        session.socket.write(writer.toBuffer());
      }

      log.status(`Character created: ${name} (id: ${lastId}) for account ${session.accountId}`);
    } catch (err) {
      log.warn(`Character creation failed: ${err}`);
    }

    return PACKET_LEN;
  }

  /**
   * CH_DELETE_CHAR (0x0068): Delete character
   */
  private handleDeleteChar(session: Session, buffer: Buffer): number {
    const PACKET_LEN = 46;
    if (buffer.length < PACKET_LEN) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE();
    const charId = reader.readUInt32LE();
    reader.readString(40); // email

    const char = queryOne('SELECT id FROM characters WHERE id = ? AND account_id = ?', [charId, session.accountId]);

    if (!char) {
      log.warn(`Delete request for non-existent char ${charId}`);
      return PACKET_LEN;
    }

    execute('DELETE FROM inventory WHERE char_id = ?', [charId]);
    execute('DELETE FROM characters WHERE id = ?', [charId]);
    log.status(`Character ${charId} deleted for account ${session.accountId}`);

    return PACKET_LEN;
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
