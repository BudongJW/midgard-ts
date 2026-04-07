# MidgardTS

A Ragnarok Online server emulator written in TypeScript, inspired by [rAthena](https://github.com/rathena/rathena), [Hercules](https://github.com/HerculesWS/Hercules), and [rust-ro](https://github.com/nmeylan/rust-ro).

## Architecture

MidgardTS follows the classic RO 3-server architecture:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Login    │────▶│  Char    │────▶│  Map     │
│  :6900    │     │  :6121   │     │  :5121   │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     └────────────────┴────────────────┘
                      │
               ┌──────────────┐
               │  SQLite DB   │
               └──────────────┘
```

- **Login Server** — Account authentication, session management
- **Char Server** — Character creation, selection, deletion
- **Map Server** — Game world: movement, chat, combat (WIP)

## Quick Start

```bash
npm install
npm run dev        # Start all servers
```

## Configuration

Edit `config.yaml` to customize server settings:

```yaml
login:
  port: 6900
  newAccountAllowed: true

map:
  baseExpRate: 100    # 1x rates
  jobExpRate: 100
  dropRate: 100
```

## Development

```bash
npm run build      # Compile TypeScript
npm run test       # Run tests
npm run dev        # Dev mode with hot reload
```

## Project Structure

```
src/
├── main.ts                 # Entry point, starts all servers
├── common/
│   ├── config/             # YAML config loader
│   ├── crypto/             # Password hashing, session IDs
│   ├── database/           # SQLite schema & queries
│   ├── logger/             # Colored console logger
│   ├── net/                # Session management
│   └── packet/             # Binary packet reader/writer
├── login/server.ts         # Login server (auth)
├── char/server.ts          # Char server (character mgmt)
└── map/server.ts           # Map server (game world)
```

## Status

This is an early-stage project. Currently implemented:
- [x] Login authentication with auto-account creation
- [x] Character creation, selection, deletion
- [x] Map entry, movement, chat
- [ ] NPC system
- [ ] Monster spawning & AI
- [ ] Combat system
- [ ] Item/inventory management
- [ ] Party/Guild system
- [ ] Skill system

## License

GPL-2.0 — Same license as rAthena and Hercules.
