# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 场景/Harness/契约/选型 | verify PASS | 39 features / 9 modules |
| 全域 domain 运行时 + Electron 工作台 | smoke + vitest + app ready | packages/shared + apps/electron |
| A–D 落地路径、E 后置 | PROGRESS/DECISIONS | 已推送 GitHub |
| Electron 启动修复（内嵌 schema、renderer 路径） | main 无 FILE_NOT_FOUND | `497866d` |
| Provider 设置 + AES credentials | smoke KEY PATH OK | main IPC |
| **A 支付沙箱（验签回调）** | gate PASS + 独立评审 7/7 | `docs/compose/spec/payment-sandbox.md`；vitest 10/10；smoke sandbox-pay |

## 进行中

| 项 | 状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步（用户拍板）

1. **B HTTP API + 最小购物前台**（Hono：商品→购物车→下单）  
2. 用户本机：模型设置填 API Key，点通 UI 与 LLM  
3. 可选：electron-builder 安装包  
4. 后续：`payment.fail_retry` 状态机（FAILED 审计 / 覆盖规则）

## 当前分支

- `feat/ecommerce-scenario-routing`
- 远程：`https://github.com/RXQ6/Apos.git`
- 工作区：`D:\apos`
- 门禁：`npm.cmd run gate`（verify && build:shared && smoke && test）
- Electron：`npm.cmd run build:shared && npm.cmd run build -w @apos/electron` 后启动 dist/main
- 镜像：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
