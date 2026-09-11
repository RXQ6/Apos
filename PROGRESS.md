# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 文档域 + Harness + 选型 + 契约 + 场景补卡 | verify 39 features | 既有 |
| 工程①–⑥ + 部分推送到 GitHub | origin | 网络曾成功 |
| **电商最小运行时切片** | `npm run smoke -w @apos/shared` | **SMOKE PASS** |
| order.create / inventory.preoccupy / inventory.deduct / inventory.release / order.cancel / inventory.oversell_guard | 领域代码 + 原子 SQL | `packages/shared/src/domain/` |
| Agent 工具：seed/create/pay/cancel/stock | tools 接 db | `tools/index.ts` |

## 进行中

| 项 | 当前状态 | 阻塞 |
|---|---|---|
| git push | 本地可能领先 | github 连接不稳 |
| Pi 真会话 | echo 仍在 | 需 API Key |

## 下一步

1. push  
2. Electron UI 挂 domain 工具演示下单链路  
3. 接 Pi Key  
4. 横向铺 payment.callback / cart 服务化  

## 当前分支

- `feat/ecommerce-scenario-routing` → `https://github.com/RXQ6/Apos.git`
- 工作区：`D:\apos`
