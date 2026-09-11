# 电商场景规划仓库（Agent Harness）

面向 Agent 与业务同学的**场景 / 模块 / 方法**文档路由库，带 Harness 纪律。

## 快速接班

1. 读 `AGENTS.md`（工作规则 + 路由）  
2. 读 `PROGRESS.md` / `DECISIONS.md`  
3. 打开 `docs/harness/feature-list.md` 取任务（WIP=1）  
4. 跑 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1`

## 目录

```text
AGENTS.md WIP/路由/下班清单
PROGRESS.md 进度  DECISIONS.md 决策  QUALITY.md 质量
features/  场景卡（行为 + verify + status）
modules/   MODULE.md + ROUTING.md + methods/
docs/harness/  INIT / VERIFY / feature-list
docs/schemas/  feature.schema.json
docs/compose/spec/  功能规格
scripts/verify.ps1  结构校验
```

实现代码不在本仓库范围内；完成定义见 `docs/harness/VERIFY.md`。
