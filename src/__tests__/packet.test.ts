import { describe, it, expect } from 'vitest';
import { PacketReader, PacketWriter } from '../common/packet/index.js';

describe('PacketWriter / PacketReader', () => {
  it('should write and read uint8', () => {
    const writer = new PacketWriter(1);
    writer.writeUInt8(0xAB);
    const reader = new PacketReader(writer.toBuffer());
    expect(reader.readUInt8()).toBe(0xAB);
  });

  it('should write and read uint16 LE', () => {
    const writer = new PacketWriter(2);
    writer.writeUInt16LE(0x0064);
    const reader = new PacketReader(writer.toBuffer());
    expect(reader.readUInt16LE()).toBe(0x0064);
  });

  it('should write and read uint32 LE', () => {
    const writer = new PacketWriter(4);
    writer.writeUInt32LE(0xDEADBEEF);
    const reader = new PacketReader(writer.toBuffer());
    expect(reader.readUInt32LE()).toBe(0xDEADBEEF);
  });

  it('should write and read null-terminated strings', () => {
    const writer = new PacketWriter(24);
    writer.writeString('TestUser', 24);
    const reader = new PacketReader(writer.toBuffer());
    expect(reader.readString(24)).toBe('TestUser');
  });

  it('should handle sequential writes and reads', () => {
    const writer = new PacketWriter(64);
    writer.writeUInt16LE(0x0064);   // packet id
    writer.writeUInt32LE(1);        // version
    writer.writeString('admin', 24); // username
    writer.writeString('pass', 24);  // password
    writer.writeUInt8(0);           // client type

    const reader = new PacketReader(writer.toBuffer());
    expect(reader.readUInt16LE()).toBe(0x0064);
    expect(reader.readUInt32LE()).toBe(1);
    expect(reader.readString(24)).toBe('admin');
    expect(reader.readString(24)).toBe('pass');
    expect(reader.readUInt8()).toBe(0);
  });

  it('should auto-grow buffer when needed', () => {
    const writer = new PacketWriter(2);
    writer.writeUInt32LE(0x12345678);
    writer.writeUInt32LE(0x9ABCDEF0);
    const buf = writer.toBuffer();
    expect(buf.length).toBe(8);
  });

  it('should track remaining bytes', () => {
    const writer = new PacketWriter(8);
    writer.writeUInt32LE(1);
    writer.writeUInt32LE(2);
    const reader = new PacketReader(writer.toBuffer());
    expect(reader.remaining).toBe(8);
    reader.readUInt32LE();
    expect(reader.remaining).toBe(4);
  });
});
