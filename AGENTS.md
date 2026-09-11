# AGENTS.md

## 这是什么

入口文件：只保留概览、首次运行、硬约束与专题索引；细节一律进链接文档。

电商**场景规划**仓库：可验收场景卡、方法模块严谨路由、Agent Harness（WIP / 完成证据 / 会话交接）。  
**不是**可运行业务代码仓；实现栈冻结在 `docs/tech-stack.md`，业务语义以文档域为准。

## 首次运行

```bash
# L1 结构校验（当前等价 make test；无 Makefile 时用此命令）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1

# 接班最小集
# 1. 读 PROGRESS.md、DECISIONS.md
# 2. 读 docs/harness/feature-list.md：续做 active，或取一个 not_started
# 3. 按 docs/harness/INIT.md 完成上班清单
```

有 Bun 工作区后优先：`bun install` → `bun run verify`（脚手架未建时仍用上面 PowerShell 命令）。

## 硬约束（不可违反）

1. **WIP=1**：全仓同时最多一个功能项 `active`。  
2. **完成 = 验证通过**：以 `harness.verify` 与 `docs/harness/VERIFY.md` 为准；禁止未跑验证就标 `passing`。  
3. **检索顺序**：本文件 → `docs/harness/feature-list.md` → `features/<id>/feature.json` + `SCENARIO.md` → `modules/<mod>/MODULE.md` + `ROUTING.md` → `methods/<name>.md`。禁止跳层臆测实现。  
4. **单一权威**：对话与清单冲突时，以 `feature-list.md` + `features/*/feature.json` 为准，并回写权威文件。  
5. **对称路由**：跨模块调用必须在双方 `ROUTING.md` 登记；禁止未登记旁路（如订单直改库存表）。  
6. **场景与方法成对**：每个场景必须有 `feature.json` + `SCENARIO.md`；每个 `role: "define"` 方法必须有对应 `methods/*.md`。  
7. **状态机**：`not_started | active | blocked | passing`；`passing` 不可逆；失败写 `blocked` + 原因。  
8. **会话交接**：退出前更新 `PROGRESS.md`；决策追加 `DECISIONS.md`；受影响模块更新 `QUALITY.md`。  
9. **任务粒度**：一次只做一件事；不做「顺便」重构；新工作先拆带 acceptance 的任务（模板见 `docs/compose/spec/`）。  
10. **契约优先**：改行为先改场景/方法文档与 `docs/contracts/p0-contracts.md`，再谈实现。

## 专题文档（一行 + 何时用）

| 文档 | 说明 | 适用 |
|---|---|---|
| `docs/harness/INIT.md` | 上班就绪清单与目录摘要 | 新会话、冷启动 |
| `docs/harness/VERIFY.md` | 三层验证、完成定义、WIP、防过早完成 | 判 Done、改状态 |
| `docs/harness/feature-list.md` | 机器可读功能索引（单一权威） | 选任务、对状态 |
| `docs/journey/user-journey.md` | 主旅程/分支/L3 走读剧本 | 闭环审查、端到端 |
| `docs/contracts/p0-contracts.md` | P0 HTTP/表/事件草案 | 写接口或库表前 |
| `docs/tech-stack.md` | 选型冻结与 monorepo 边界 | 脚手架、进程/DB |
| `docs/schemas/feature.schema.json` | 场景卡字段约束 | 增改 feature.json |
| `docs/glossary.md` | 业务术语 | 对齐 SKU/预占等 |
| `QUALITY.md` | 模块质量快照 | 优先修低分模块 |
| `DECISIONS.md` | 决策日志 | 为何这样设计 |
| `PROGRESS.md` | 完成/进行/下一步 | 接班第一读 |
| `modules/*/MODULE.md` | 模块边界与方法索引 | 加能力前 |
| `modules/*/ROUTING.md` | 允许/禁止调用 | 改跨模块流 |
| `docs/compose/spec/*.md` | 功能 Spec 与任务 | 交付记录 |

模块：`modules/{catalog,cart,inventory,pricing,order,payment,fulfillment,aftersale,customer}/`。

## 下班清单

- [ ] `scripts/verify.ps1` 通过  
- [ ] `PROGRESS.md` 已更新  
- [ ] `feature-list.md` 与各 `feature.json` 的 harness 状态一致  
- [ ] 无临时调试文件  
- [ ] INIT 路径仍可跑通  
