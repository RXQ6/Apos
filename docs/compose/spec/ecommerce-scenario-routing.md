---
feature: ecommerce-scenario-routing
status: in-progress
updated: 2026-09-11
branch: feat/ecommerce-scenario-routing
commits: # filled at delivery
---

# 电商场景规划与严谨路由骨架

## Report

（交付时填写）

## [S1] Problem

需要从零建立电商「场景规划」仓库：业务方/Agent 能按固定路径检索场景、模块与方法职责；每条业务故事有 `feature.json`，每个方法模块有 `MODULE.md`/`ROUTING.md`，避免口头约定与旁路实现。

## [S2] Design

三层模型：

1. **场景层** `features/<id>/`：`feature.json` + `SCENARIO.md`，描述可验收业务故事。
2. **模块层** `modules/<mod>/`：`MODULE.md`（边界与方法索引）、`ROUTING.md`（允许/禁止路由）、`methods/<name>.md`（方法契约）。
3. **导航层** `AGENTS.md`：强制检索顺序 `AGENTS → feature.json → MODULE → ROUTING → method`。

契约要点：

- 场景只引用模块/方法 ID，不写散落实现。
- 模块只声明直接依赖；跨模块调用必须在双方 `ROUTING.md` 对称登记。
- 每方法必须有 MD：职责、入参出参、失败、幂等、禁止事项。
- `feature.schema.json` 约束场景卡必填字段。

首期模块（全开）：`catalog`, `inventory`, `pricing`, `order`, `payment`, `fulfillment`, `aftersale`, `customer`。

场景矩阵按各模块 happy-path / exception / variant 横向扩展；P0 主链路优先写全，其余允许 `status: draft` 占位。

### [S2b] Harness 修订（2026-09-11）

按用户提供的 Agent Harness 规范追加：

- 状态持久化：`PROGRESS.md`、`DECISIONS.md`、git 检查点、下班清单
- 初始化：`docs/harness/INIT.md`、`scripts/verify.ps1`
- 边界：WIP=1、完成证据、防过早完成（`docs/harness/VERIFY.md`）
- 功能清单原语：`docs/harness/feature-list.md` + `feature.json` 的 `harness.{status,verify}`
- 验证层级 L1/L2/L3；质量表 `QUALITY.md`
- 不新建 worktree，继续 `feat/ecommerce-scenario-routing`

## [S3] Out of Scope

- 真实业务代码实现、数据库、渠道对接
- 跨境清关、分账结算、平台级秒杀压测
- 多仓路由算法细节、风控模型训练

## Tasks

- [x] T1: 初始化仓库分支与本 Spec — acceptance: 分支存在且本文档 status=designed (covers: S2)
- [x] T2: 写入 AGENTS.md、README、feature.schema.json、glossary.md — acceptance: 四文件存在且含检索顺序/模块索引/schema 必填字段 (covers: S2)
- [x] T3: 创建 8 模块 MODULE.md + ROUTING.md — acceptance: 每模块两文件存在且含职责/路由表 (covers: S2)
- [x] T4: 落地 P0 主链路 feature.json + SCENARIO.md + 关键 methods MD — acceptance: 主链路场景卡通过 schema 字段自检，方法有 MD (covers: S2; depends: T2, T3)
- [x] T5: Harness 文档与状态文件 — acceptance: PROGRESS/DECISIONS/QUALITY/INIT/VERIFY/feature-list/verify.ps1 存在 (covers: S2b)
- [x] T6: AGENTS 纳入 WIP/初始化/完成定义/下班清单 — acceptance: AGENTS 含上述章节 (covers: S2b)
- [x] T7: feature schema + 全部场景卡 harness 字段 — acceptance: scripts/verify.ps1 通过且 active<=1 (covers: S2b; depends: T5)
