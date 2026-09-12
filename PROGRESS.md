# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 场景/Harness/契约/选型 | verify PASS | 40 features / 9 modules |
| 全域 domain + Electron + 支付沙箱 + shop | gate PASS | packages/shared + apps/shop + apps/electron |
| 超时关单 + 失败重试 | gate PASS | `payment-timeout-fail-retry` |
| **全场景收口 40/40 passing** | gate PASS | `docs/compose/spec/scenario-closeout-all.md`；shared 25/25 + shop 7/7 |

## 进行中

| 项 | 状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步（可选增强，非阻塞）

1. `git push`（网络恢复后；本地 ahead 若干）  
2. Electron 内嵌 shop / 安装包  
3. 真实支付渠道与生产鉴权  
4. 前台优惠券 UI 完整化  

## 当前分支

- `feat/ecommerce-scenario-routing`
- 远程：`https://github.com/RXQ6/Apos.git`
- 工作区：`D:\apos`
- 门禁：`npm.cmd run gate` → **40/40 passing**
- 小店：`npm.cmd run shop` → `http://127.0.0.1:8787`
