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
- **Map Server** — Game world: movement, chat, combat (WIP)

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
│   ├── net/                # Session management
│   └── packet/             # Binary packet reader/writer
├── login/server.ts         # Login server (auth)
├── char/server.ts          # Char server (character mgmt)
└── map/server.ts           # Map server (game world)
```

### Status

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
- **地图服务器** — 游戏世界：移动、聊天、战斗（开发中）

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
│   ├── net/                # 会话管理
│   └── packet/             # 二进制数据包读写器
├── login/server.ts         # 登录服务器（认证）
├── char/server.ts          # 角色服务器（角色管理）
└── map/server.ts           # 地图服务器（游戏世界）
```

### 开发状态

本项目处于早期阶段。目前已实现：
- [x] 登录认证（支持自动创建账号）
- [x] 角色创建、选择、删除
- [x] 地图进入、移动、聊天
- [ ] NPC 系统
- [ ] 怪物生成与 AI
- [ ] 战斗系统
- [ ] 物品/背包管理
- [ ] 组队/公会系统
- [ ] 技能系统

### 许可证

GPL-2.0 — 与 rAthena 和 Hercules 采用相同许可证。
