# VERIFY — 验证层级与完成定义

## 三层验证

| 层 | 何时 | 本仓库对应 | 完成门槛 |
|---|---|---|---|
| L1 静态/结构 | 每次改文档后 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1` | 必须通过 |
| L2 交叉引用 | 改路由/依赖时 | feature↔method ID 双方 ROUTING 对称；schema 枚举合法 | 涉及则必须 |
| L3 端到端演练 | 主链路验收 | 按 SCENARIO 步骤走读：order→inventory→payment→fulfillment | P0 designed 场景 |

规则：L1 未过不进 L2；L2 未过不进 L3。跳过必过层 = **未完成**。

## 完成定义（Done）

同时满足才算完成：

1. 任务通过对应验证层  
2. 清洁状态：`PROGRESS.md` 已更新、无临时调试文件、标准启动路径可用（见 `AGENTS.md` 下班清单）  
3. 功能清单状态变为 `passing`（不可逆；失败只能 `blocked` 并修复后再验）

## 功能项三元组

每个功能必须有：

1. **行为**：做什么（feature.json `summary` + SCENARIO）  
2. **验证命令**：怎么算完（feature.json `harness.verify`）  
3. **状态**：`not_started | active | blocked | passing`（harness 控制，不是 agent 主观宣布）

## 状态机

```text
not_started → active → passing
                ↓
             blocked → active
```

- `active` → `passing`：仅当 verify 命令成功  
- WIP：同一时刻最多 1 个 `active`（强制 WIP=1）

## 防过早完成

- 完成判定以外部 verify 为准，不以「代码/文档看起来没问题」为准  
- agent 不得在未跑 verify 时把状态改成 `passing`
