# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 场景/Harness/契约/选型 | verify PASS | 40 features / 9 modules |
| 全域 domain 运行时 + Electron 工作台 | smoke + vitest + app ready | packages/shared + apps/electron |
| A–D 落地路径、E 后置 | PROGRESS/DECISIONS | 已推送 GitHub |
| Electron 启动修复（内嵌 schema、renderer 路径） | main 无 FILE_NOT_FOUND | `497866d` |
| Provider 设置 + AES credentials | smoke KEY PATH OK | main IPC |
| A 支付沙箱（验签回调） | gate PASS + 独立评审 | `docs/compose/spec/payment-sandbox.md` |
| **B Hono API + 最小购物前台** | gate PASS + shop vitest 5/5 | `apps/shop`；`docs/compose/spec/shop-http-storefront.md` |

## 进行中

| 项 | 状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步（用户拍板）

1. 启动小店：`npm.cmd run shop` → 打开 `http://127.0.0.1:8787`  
2. 用户本机：Electron 模型设置填 API Key  
3. P0 缺口场景：`order.get` 文档化 / `payment.fail_retry` / 超时关单  
4. 可选：electron-builder 安装包；Electron 内嵌 shop

## 当前分支

- `feat/ecommerce-scenario-routing`
- 远程：`https://github.com/RXQ6/Apos.git`
- 工作区：`D:\apos`
- 门禁：`npm.cmd run gate`
- 小店：`npm.cmd run shop`（PORT 默认 8787；DB 可用 `APOS_SHOP_DB`）
- Electron：`npm.cmd run build:shared && npm.cmd run build -w @apos/electron`
