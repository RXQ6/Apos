# Apos（景枢）

电商**场景规划智能工作台**：用 Pi Agent 按 `features/`/`modules/` 严谨路由，调度场景、跑验证、推进可落地的业务闭环。

## 首次运行

```bash
npm install
# Electron 二进制若下载失败（GitHub 超时），可用镜像后重装：
# $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
# npm install electron --workspace=@apos/electron
npm run verify          # 文档 L1
npm run test            # domain 单测
npm run smoke           # 冒烟
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
