# tech-stack — 技术选型（已冻结）

> 2026-09-11 用户确认冻结。运行时竖切与全域 domain 服务已落地（见 `packages/shared/src/domain/`）。
> 参考蓝本：[craft-agents-oss](https://github.com/craft-ai-agents/craft-agents-oss)（布局/UI/构建对齐；产品边界不同）。

## 产品形态

- **主形态（2026-09-12 用户拍板）**：**纯网页版** — Hono 单进程提供 Agent 工作台 `/workbench` + 购物小店 `/`
- Electron 降为可选桌面壳（非主路径）
- 权威数据仍是文档路由：`AGENTS.md` / `features/` / `modules/`；SQLite/JSONL 为镜像与运行态
- 不做通用 Agent 壳；第一期不做 MCP Sources / CLI（接口可预留）

## 栈一览

| 层 | 选型 | 备注 |
|---|---|---|
| 语言 | TypeScript 5.9.x | 与 Pi 同代；`strict` + `noUncheckedIndexedAccess` |
| 模块 | ESM only（`"type": "module"`） | Pi / Bun / Vite 一致 |
| 运行时/包管理 | **Bun** | `bun install` / `bun:sqlite` / Vitest |
| Agent | `@earendil-works/pi-agent-core` + `@earendil-works/pi-ai` | Node engines ≥ 22.19；单后端，不接 Claude Agent SDK |
| 工具 Schema | **TypeBox** | 与 Pi 一致，不引入 Zod 双轨 |
| 桌面 | Electron + React | main / preload / renderer |
| 构建 | esbuild（main）+ Vite（renderer） | 照抄 Craft，不用 electron-vite 全家桶 |
| UI | Tailwind CSS **v4** + **shadcn/ui** | |
| 数据 | **`bun:sqlite`** | 手写轻量 schema SQL / DAO，不上 Drizzle |
| 会话 | **SQLite 表 + JSONL 双写** | 库可查询；JSONL 便于调试与审阅 |
| 凭证 | AES-256-GCM 文件 | 模型 API Key 等 |
| 权限 | Explore / Ask / Auto | 工具层白名单 |
| 校验 | `scripts/verify.ps1` → `bun run verify` | L1 文档结构；后续可挂 TS typecheck |
| 测试 | Vitest | |
| Lint/Format | **Biome**（推荐默认） | 贴 Bun；可改为 ESLint+Prettier |
| 配置根 | `~/.apos/` | 避开 Craft 的 `~/.craft-agent` |
| DB 路径 | `~/.apos/data.db` | |
| 会话文件 | `~/.apos/workspaces/<id>/sessions/*.jsonl` | 双写一侧 |

## monorepo 布局（拟）

```text
apps/
  electron/
    src/main/       # 窗口、配置、SQLite 独占、Agent 编排入口
    src/preload/    # 窄 IPC API
    src/renderer/   # React UI（禁 Node API）
  cli/              # 预留，第一期不实现
packages/
  shared/           # @apos/shared：agent(Pi)、db、tools、session、types
features/ modules/ docs/ scripts/   # 现有文档域保持权威
```

## 进程与数据边界

| 进程 | 职责 |
|---|---|
| Renderer | 仅 UI；不碰 DB / Agent / fs |
| Main | 窗口、凭证、**SQLite**、启动 Pi session 逻辑 |
| Shared | 类型化工具：feature 读写、ROUTING 检查、verify、PROGRESS 更新 |

- 第一期 Agent 在 main 内跑（同 Craft）；若以后要隔离，再抽 server/thin-client
- IPC 契约类型只来自 `@apos/shared`

## 与 Craft 的刻意差异

1. 仅 **Pi** 后端，不做 Claude 双栈  
2. 业务域是电商场景文档路由，不是通用多源 Agent  
3. 持久化以 **SQLite** 为主（Craft 偏 JSONL 文件）  
4. UI 的状态机对齐 harness：`not_started | active | blocked | passing`，且 **WIP=1**

## 开放项（不阻塞实现）

| 项 | 状态 |
|---|---|
| 产品英文名 / 配置目录品牌 | 暂用 `apos` / `~/.apos` |
| CLI、MCP Sources、远程 server | 后期 |
| Windows 打包（builder/forge） | 发布前再定 |
| 默认 LLM Provider | 经 pi-ai 可配；UI 先留一种配置 |

## 明确不做（本阶段）

- 微服务、Kafka、Postgres  
- NestJS / Prisma  
- 真实支付渠道对接（业务仍以文档/场景为准）
