# SCENARIO — agent.workbench

> 产品侧场景（Apos 工作台），不走电商 ROUTING。

## 前置

- `npm install` + `npm run build:shared`

## 正常步骤

1. `npm run dev` 启动 Electron
2. init 拉取 feature 列表与权限模式
3. 输入 `/feature_list_read`、`/verify_run`、`/tools`
4. 流式展示 assistant 输出

## 异常

- 无 display/缺依赖 → 记日志，CLI smoke 仍可用（shared）

## 验收

见 feature.json acceptance
