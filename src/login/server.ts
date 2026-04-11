/**
 * MidgardTS Login Server
 * Handles account authentication
 * Inspired by rAthena login-server and Hercules login
 */

import { createServer, type Socket } from 'node:net';
import { PacketReader, PacketWriter, PacketId } from '../common/packet/index.js';
import { createLogger } from '../common/logger/index.js';
import { hashPassword, verifyPassword, generateSessionId } from '../common/crypto/index.js';
import { queryOne, execute } from '../common/database/index.js';
import { SessionManager, type Session } from '../common/net/session.js';
import { authStore } from '../common/net/auth-store.js';
import { RateLimiter } from '../common/net/rate-limiter.js';
import type { ServerConfig } from '../common/config/index.js';

const log = createLogger('Login');

const MAX_LOGIN_ATTEMPTS = 10;   // per IP per minute
const CONNECTION_TIMEOUT_MS = 30_000;

export class LoginServer {
  private sessions = new SessionManager();
  private rateLimiter = new RateLimiter(MAX_LOGIN_ATTEMPTS, 60_000);
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => this.onConnection(socket));
      const { host, port } = this.config.login;

      server.listen(port, host, () => {
        log.status(`Login server listening on ${host}:${port}`);
        resolve();
      });

      server.on('error', (err) => {
        log.fatal(`Login server error: ${err.message}`);
        reject(err);
      });
    });
  }

  private onConnection(socket: Socket): void {
    const session = this.sessions.create(socket);
    log.info(`New connection from ${session.ip} (session ${session.id})`);

    // Connection idle timeout
    socket.setTimeout(CONNECTION_TIMEOUT_MS, () => {
      log.info(`Connection timeout for ${session.ip}`);
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
      case PacketId.CA_LOGIN:
        return this.handleLogin(session, buffer);
      case PacketId.CZ_REQUEST_TIME:
        return this.handleKeepAlive(session, buffer);
      default:
        log.warn(`Unknown packet 0x${packetId.toString(16).padStart(4, '0')} from ${session.ip}, closing`);
        session.socket.destroy();
        return buffer.length;
    }
  }

  /**
   * CA_LOGIN (0x0064): Account login request
   * Structure: <packet_id>.W <version>.L <username>.24B <password>.24B <client_type>.B
   * Total: 55 bytes
   */
  private handleLogin(session: Session, buffer: Buffer): number {
    const PACKET_LEN = 55;
    if (buffer.length < PACKET_LEN) return 0;

    const reader = new PacketReader(buffer);
    reader.readUInt16LE(); // packet id
    const version = reader.readUInt32LE();
    const username = reader.readString(24);
    const password = reader.readString(24);
    const clientType = reader.readUInt8();

    log.info(`Login attempt: ${username} (v${version}, type=${clientType})`);

    // Rate limit check
    if (!this.rateLimiter.check(session.ip)) {
      log.warn(`Rate limited: ${session.ip}`);
      this.sendLoginRefuse(session, 6); // 6 = server full (closest available code)
      return PACKET_LEN;
    }

    const account = queryOne<{ id: number; password: string; group_id: number; state: number }>(
      'SELECT id, password, group_id, state FROM accounts WHERE username = ?',
      [username],
    );

    if (!account) {
      if (this.config.login.newAccountAllowed) {
        const hashed = hashPassword(password);
        const { lastId } = execute('INSERT INTO accounts (username, password) VALUES (?, ?)', [username, hashed]);
        log.status(`New account created: ${username} (id: ${lastId})`);
        this.sendLoginAccept(session, lastId);
      } else {
        this.sendLoginRefuse(session, 0);
      }
      return PACKET_LEN;
    }

    if (account.state !== 0) {
      this.sendLoginRefuse(session, 5);
      return PACKET_LEN;
    }

    if (!verifyPassword(password, account.password)) {
      this.sendLoginRefuse(session, 1);
      execute('INSERT INTO login_log (ip, user_id, result) VALUES (?, ?, ?)', [session.ip, username, 'fail']);
      return PACKET_LEN;
    }

    execute('UPDATE accounts SET login_count = login_count + 1, last_login = datetime("now"), last_ip = ? WHERE id = ?', [
      session.ip,
      account.id,
    ]);
    execute('INSERT INTO login_log (ip, user_id, result) VALUES (?, ?, ?)', [session.ip, username, 'success']);

    this.sendLoginAccept(session, account.id);
    return PACKET_LEN;
  }

  private sendLoginAccept(session: Session, accountId: number): void {
    session.accountId = accountId;
    session.loginId1 = generateSessionId();
    session.loginId2 = generateSessionId();

    // Register session for inter-server authentication
    authStore.register({
      accountId,
      loginId1: session.loginId1,
      loginId2: session.loginId2,
      sex: 0,
      ip: session.ip,
      createdAt: Date.now(),
    });

    const charHost = this.config.char.host === '0.0.0.0' ? '127.0.0.1' : this.config.char.host;
    const charPort = this.config.char.port;
    const ipParts = charHost.split('.').map(Number);

    // AC_ACCEPT_LOGIN: header(4) + loginId1(4) + accountId(4) + loginId2(4) + unused(4) + lastLogin(26) + sex(1) = 47 base
    // + char server entries (32 bytes each)
    const writer = new PacketWriter(80);
    writer.writeUInt16LE(PacketId.AC_ACCEPT_LOGIN);
    writer.writeUInt16LE(47 + 32);
    writer.writeUInt32LE(session.loginId1);
    writer.writeUInt32LE(accountId);
    writer.writeUInt32LE(session.loginId2);
    writer.writeUInt32LE(0);
    writer.writeString('', 26);
    writer.writeUInt8(0);

    // Char server entry (32 bytes)
    writer.writeUInt8(ipParts[0] ?? 127);
    writer.writeUInt8(ipParts[1] ?? 0);
    writer.writeUInt8(ipParts[2] ?? 0);
    writer.writeUInt8(ipParts[3] ?? 1);
    writer.writeUInt16LE(charPort);
    writer.writeString('MidgardTS', 20);
    writer.writeUInt16LE(0);
    writer.writeUInt16LE(0);
    writer.writeUInt16LE(0);

    session.socket.write(writer.toBuffer());
    log.status(`Login accepted for account ${accountId}`);
  }

  private sendLoginRefuse(session: Session, reason: number): void {
    const writer = new PacketWriter(23);
    writer.writeUInt16LE(PacketId.AC_REFUSE_LOGIN);
    writer.writeUInt8(reason);
    writer.writeString('', 20);

    session.socket.write(writer.toBuffer());
    log.warn(`Login refused for ${session.ip}, reason: ${reason}`);
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
