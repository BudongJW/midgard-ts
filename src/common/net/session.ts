/**
 * MidgardTS Session Manager
 * Tracks connected client sessions across servers
 */

import type { Socket } from 'node:net';

export interface Session {
  id: number;
  accountId: number;
  loginId1: number;
  loginId2: number;
  sex: number;
  socket: Socket;
  ip: string;
}

export class SessionManager {
  private sessions = new Map<number, Session>();
  private socketToSession = new Map<Socket, Session>();
  private nextId = 1;

  create(socket: Socket): Session {
    const session: Session = {
      id: this.nextId++,
      accountId: 0,
      loginId1: 0,
      loginId2: 0,
      sex: 0,
      socket,
      ip: socket.remoteAddress ?? 'unknown',
    };
    this.sessions.set(session.id, session);
    this.socketToSession.set(socket, session);
    return session;
  }

  getBySocket(socket: Socket): Session | undefined {
    return this.socketToSession.get(socket);
  }

  getByAccountId(accountId: number): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.accountId === accountId) return session;
    }
    return undefined;
  }

  remove(socket: Socket): void {
    const session = this.socketToSession.get(socket);
    if (session) {
      this.sessions.delete(session.id);
      this.socketToSession.delete(socket);
    }
  }

  get count(): number {
    return this.sessions.size;
  }
}
