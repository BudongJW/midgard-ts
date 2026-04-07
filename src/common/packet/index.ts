/**
 * MidgardTS Packet System
 * Binary packet reader/writer for RO client protocol
 * Inspired by rAthena's packet_db and Hercules' packet system
 */

export class PacketReader {
  private buffer: Buffer;
  private offset: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  get position(): number {
    return this.offset;
  }

  readUInt8(): number {
    const val = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return val;
  }

  readUInt16LE(): number {
    const val = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return val;
  }

  readUInt32LE(): number {
    const val = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return val;
  }

  readInt32LE(): number {
    const val = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return val;
  }

  readString(length: number): string {
    const slice = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    const nullIdx = slice.indexOf(0);
    return slice.subarray(0, nullIdx === -1 ? length : nullIdx).toString('ascii');
  }

  readBytes(length: number): Buffer {
    const slice = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return Buffer.from(slice);
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }
}

export class PacketWriter {
  private buffer: Buffer;
  private offset: number;

  constructor(size: number = 1024) {
    this.buffer = Buffer.alloc(size);
    this.offset = 0;
  }

  private ensure(bytes: number): void {
    if (this.offset + bytes > this.buffer.length) {
      const newBuf = Buffer.alloc(Math.max(this.buffer.length * 2, this.offset + bytes));
      this.buffer.copy(newBuf);
      this.buffer = newBuf;
    }
  }

  writeUInt8(val: number): this {
    this.ensure(1);
    this.buffer.writeUInt8(val, this.offset);
    this.offset += 1;
    return this;
  }

  writeUInt16LE(val: number): this {
    this.ensure(2);
    this.buffer.writeUInt16LE(val, this.offset);
    this.offset += 2;
    return this;
  }

  writeUInt32LE(val: number): this {
    this.ensure(4);
    this.buffer.writeUInt32LE(val, this.offset);
    this.offset += 4;
    return this;
  }

  writeInt32LE(val: number): this {
    this.ensure(4);
    this.buffer.writeInt32LE(val, this.offset);
    this.offset += 4;
    return this;
  }

  writeString(str: string, length: number): this {
    this.ensure(length);
    const written = this.buffer.write(str, this.offset, length, 'ascii');
    // Zero-fill remaining bytes
    this.buffer.fill(0, this.offset + written, this.offset + length);
    this.offset += length;
    return this;
  }

  writeBytes(data: Buffer): this {
    this.ensure(data.length);
    data.copy(this.buffer, this.offset);
    this.offset += data.length;
    return this;
  }

  toBuffer(): Buffer {
    return this.buffer.subarray(0, this.offset);
  }
}

// RO Packet IDs (subset, based on rAthena packet_db)
export enum PacketId {
  // Login
  CA_LOGIN              = 0x0064,  // Client -> Login: Account login
  AC_ACCEPT_LOGIN       = 0x0069,  // Login -> Client: Login accepted
  AC_REFUSE_LOGIN       = 0x006a,  // Login -> Client: Login refused

  // Char
  CH_ENTER              = 0x0065,  // Client -> Char: Enter char select
  HC_ACCEPT_ENTER       = 0x006b,  // Char -> Client: Char list
  CH_SELECT_CHAR        = 0x0066,  // Client -> Char: Select character
  HC_NOTIFY_ZONESVR     = 0x0071,  // Char -> Client: Map server info
  CH_MAKE_CHAR          = 0x0067,  // Client -> Char: Create character
  HC_ACCEPT_MAKECHAR    = 0x006d,  // Char -> Client: Char created
  CH_DELETE_CHAR         = 0x0068,  // Client -> Char: Delete character

  // Map
  CZ_ENTER              = 0x0436,  // Client -> Map: Enter map
  ZC_ACCEPT_ENTER       = 0x0073,  // Map -> Client: Map entered
  CZ_REQUEST_MOVE       = 0x0085,  // Client -> Map: Move request
  ZC_NOTIFY_PLAYERMOVE  = 0x0087,  // Map -> Client: Player moved
  CZ_REQUEST_CHAT       = 0x008c,  // Client -> Map: Chat message
  ZC_NOTIFY_CHAT        = 0x008d,  // Map -> Client: Chat broadcast

  // Keep alive
  CZ_REQUEST_TIME       = 0x007e,  // Client -> Server: Tick
  ZC_NOTIFY_TIME        = 0x007f,  // Server -> Client: Tick reply
}
