# INIT — 启动就绪清单（上班流程）

新会话或接班 Agent **先跑本清单**，再动业务内容。

## 标准化命令（文档仓）

| 步骤 | 命令/动作 | 通过条件 |
|---|---|---|
| setup | 无需安装依赖；确认在 `D:\apos` | 目录含 `AGENTS.md` |
| read | 读 `AGENTS.md` → `PROGRESS.md` → `DECISIONS.md` | 知道 WIP 与下一步 |
| pick | 在 `docs/harness/feature-list.md` 取 **一个** `not_started` 或继续 `active` | 任意时刻仅 1 个 active |
| check | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1` | 退出码 0 |

## 当前就绪

- [x] 可运行：纯文档仓库，无构建依赖
- [x] 可验证：`scripts/verify.ps1` 结构检查
- [x] 就绪清单：本文件
- [x] 功能清单：`docs/harness/feature-list.md` + `features/*/feature.json`

## 项目结构（摘要）

```text
AGENTS.md PROGRESS.md DECISIONS.md QUALITY.md
features/<id>/{feature.json,SCENARIO.md}
modules/<mod>/{MODULE.md,ROUTING.md,methods/*.md}
docs/harness/{INIT,VERIFY,feature-list}.md
docs/schemas/feature.schema.json
docs/compose/spec/
scripts/verify.ps1
```

## 热启动

不要从空上下文硬干：先读 PROGRESS 的「进行中/下一步」，再按 feature-list 状态机继续。
