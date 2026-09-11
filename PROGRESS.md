# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 仓库骨架 + Harness + 技术选型冻结 | verify / tech-stack | 既有 |
| 3 条业务阻塞拍板（扣减时机/优惠优先级/退货门槛）+ 超卖策略 | DECISIONS 表 | 2026-09-11 |
| 用户旅程总图 | `docs/journey/user-journey.md` | L3 剧本可走读 |
| cart 模块 + P0 缺口场景卡（注册/搜索/详情/charge/cancel/get/sign/return_refund 等） | feature 数上升 | verify |
| P0 契约草案 API/表/事件 | `docs/contracts/p0-contracts.md` | 与场景映射 |

## 进行中

| 项 | 当前状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步

1. 代码脚手架（Bun monorepo + electron 空壳）— **需用户点头才写业务/工程代码**
2. `order.create` L3 走读后标 `passing`（当前 active）
3. 可选：commit

## 当前分支

- 分支：`feat/ecommerce-scenario-routing`
- 工作区：`D:\apos`
- 校验：Bypass `scripts/verify.ps1`
