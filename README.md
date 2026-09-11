# Apos（景枢）

电商**场景规划智能工作台**：用 Pi Agent 按 `features/`/`modules/` 严谨路由，调度场景、跑验证、推进可落地的业务闭环。

## 首次运行

```bash
npm install
npm run verify          # 文档 L1
npm run typecheck       # TS（需先 build shared）
npm run build:shared
npm run dev             # Electron + Vite
```

配置根：`~/.apos/`（`data.db` + `sessions/` JSONL 双写）。

## 目录

```text
apps/electron     main / preload / renderer
packages/shared   agent runner、tools、db、types
features/ modules/ docs/   文档权威域
```

文档入口：`AGENTS.md`。
