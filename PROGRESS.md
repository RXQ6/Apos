# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 场景/Harness/契约/选型 | verify PASS | 40 features |
| 全域 domain 运行时 + Electron 工作台 | smoke + vitest + app ready | packages/shared + apps/electron |
| A 支付沙箱（验签回调） | gate PASS | `docs/compose/spec/payment-sandbox.md` |
| B Hono API + 最小购物前台 | gate PASS | `apps/shop` |
| **超时关单 + 支付失败重试** | gate PASS / 22 passing | `docs/compose/spec/payment-timeout-fail-retry.md`；shared 15/15 |

## 进行中

| 项 | 状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步（用户拍板）

1. 收口已有能力未验收：`cart.update` / `cart.merge` / `catalog.detail` / `order.get`  
2. 优惠与营销：`pricing.quote` + 券  
3. 用户本机：Electron 填 API Key；小店 `npm.cmd run shop`  
4. 可选：安装包；git push（若网络仍断）

## 当前分支

- `feat/ecommerce-scenario-routing`
- 远程：`https://github.com/RXQ6/Apos.git`
- 工作区：`D:\apos`
- 门禁：`npm.cmd run gate`（verify 40 / **22 passing**）
- 小店：`npm.cmd run shop` → `http://127.0.0.1:8787`
