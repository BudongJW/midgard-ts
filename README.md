# MidgardTS

A Ragnarok Online server emulator written in TypeScript, inspired by [rAthena](https://github.com/rathena/rathena), [Hercules](https://github.com/HerculesWS/Hercules), and [rust-ro](https://github.com/nmeylan/rust-ro).

[English](#english) | [中文](#中文)

---

## English

### Architecture

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
- **Map Server** — Game world: movement, chat, NPCs, combat, skills

### Quick Start

```bash
npm install
npm run dev        # Start all servers
```

### Configuration

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

### Development

```bash
npm run build      # Compile TypeScript
npm run test       # Run tests
npm run dev        # Dev mode with hot reload
```

### Project Structure

```
src/
├── main.ts                 # Entry point, starts all servers
├── common/
│   ├── config/             # YAML config loader
│   ├── crypto/             # Password hashing, session IDs
│   ├── database/           # SQLite schema & queries
│   ├── logger/             # Colored console logger
│   ├── net/                # Session, auth store, rate limiter
│   └── packet/             # Binary packet reader/writer
├── login/server.ts         # Login server (auth)
├── char/server.ts          # Char server (character mgmt)
└── map/
    ├── server.ts           # Map server (game world)
    ├── item/
    │   ├── item-db.ts      # 60+ item definitions
    │   └── inventory.ts    # Equip, use, stack, stat calc
    ├── npc/
    │   ├── npc-db.ts       # NPC definitions & dialogue trees
    │   └── npc-handler.ts  # Dialogue, shop, warp handlers
    ├── monster/
    │   ├── mob-db.ts       # Monster stats, drops, map spawns
    │   └── mob-spawner.ts  # Instance management, AI tick, respawn
    ├── combat/
    │   ├── damage-calc.ts  # RO damage formula (ATK/DEF, HIT/FLEE, crit)
    │   └── combat-handler.ts # Attack processing, EXP/drop, level-up
    ├── skill/
    │   ├── skill-db.ts     # 11 skills (Bash, Bolts, Heal, etc.)
    │   └── skill-handler.ts # SP cost, cooldown, effect processing
    ├── party/
    │   └── party-manager.ts # Create/join/leave, EXP share
    ├── guild/
    │   └── guild-manager.ts # Guild CRUD, positions, EXP tax, alliances
    ├── pvp/
    │   └── pvp-manager.ts  # PvP maps, rankings, WoE castles
    ├── pet/
    │   ├── pet-db.ts       # 7 tameable pets, bonuses
    │   └── pet-handler.ts  # Tame, hatch, feed, intimacy, stat bonus
    └── trade/
        ├── vending.ts      # Player shops (vending)
        └── trade-handler.ts # P2P item/zeny trading
```

### License

GPL-2.0 — Same license as rAthena and Hercules.

---

## 中文

### 简介

MidgardTS 是一个使用 TypeScript 编写的仙境传说（Ragnarok Online）服务器模拟器，灵感来源于 [rAthena](https://github.com/rathena/rathena)、[Hercules](https://github.com/HerculesWS/Hercules) 和 [rust-ro](https://github.com/nmeylan/rust-ro)。

### 架构

MidgardTS 采用经典的 RO 三服务器架构：

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  登录服务器 │────▶│ 角色服务器  │────▶│ 地图服务器  │
│  :6900    │     │  :6121   │     │  :5121   │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     └────────────────┴────────────────┘
                      │
               ┌──────────────┐
               │  SQLite 数据库 │
               └──────────────┘
```

- **登录服务器** — 账号认证、会话管理
- **角色服务器** — 角色创建、选择、删除
- **地图服务器** — 游戏世界：移动、聊天、NPC、战斗、技能

### 快速开始

```bash
npm install
npm run dev        # 启动所有服务器
```

### 配置

编辑 `config.yaml` 自定义服务器设置：

```yaml
login:
  port: 6900
  newAccountAllowed: true    # 允许自动创建账号

map:
  baseExpRate: 100    # 100 = 1倍经验
  jobExpRate: 100
  dropRate: 100
```

### 开发

```bash
npm run build      # 编译 TypeScript
npm run test       # 运行测试
npm run dev        # 开发模式（热重载）
```

### 项目结构

```
src/
├── main.ts                 # 入口，启动所有服务器
├── common/
│   ├── config/             # YAML 配置加载器
│   ├── crypto/             # 密码哈希、会话ID生成
│   ├── database/           # SQLite 数据库模式与查询
│   ├── logger/             # 彩色控制台日志
│   ├── net/                # 会话管理、认证、限流
│   └── packet/             # 二进制数据包读写器
├── login/server.ts         # 登录服务器（认证）
├── char/server.ts          # 角色服务器（角色管理）
└── map/
    ├── server.ts           # 地图服务器（游戏世界）
    ├── item/               # 道具数据库(60+)、背包系统
    ├── npc/                # NPC定义、对话、商店、传送
    ├── monster/            # 怪物数据库、刷怪、AI
    ├── combat/             # RO伤害公式、战斗处理、升级
    ├── skill/              # 技能数据库(11)、SP消耗、冷却
    ├── party/              # 组队、经验分配
    ├── guild/              # 公会 CRUD、职位、经验税、同盟
    ├── pvp/                # PvP 地图、排行榜、攻城战
    ├── pet/                # 宠物数据库(7)、亲密度、属性加成
    └── trade/              # 摆摊、玩家交易
```

### 许可证

GPL-2.0 — 与 rAthena 和 Hercules 采用相同许可证。
