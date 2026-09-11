# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 仓库骨架 + Harness + 技术选型 + 业务拍板 + 契约/旅程 | verify PASS | 既有 |
| 项目命名 **Apos（景枢）** | README | 场景规划智能工作台 |
| ① 文档基线 commit | git | `5cc6055` |
| ② Bun/Node monorepo + Electron 空壳 | esbuild 产出 main/preload | `apps/electron/dist` |
| ③ Agent runner + echo/工具 + 流式事件面 | smoke | `@apos/shared` AposAgentRunner |
| ④ SQLite schema + JSONL 双写 API | smoke | `node:sqlite` + sessions |
| ⑤ 真工具 feature_list_read / verify_run / progress_update | smoke | explore 挡写工具 |
| ⑥ 权限三档 explore/ask/allow-all | runner + UI | 接线完成 |
| 共享层 typecheck / verify | tsc -b + verify.ps1 | 通过 |

## 进行中

| 项 | 当前状态 | 阻塞 |
|---|---|---|
| Pi LLM 真会话（替换 echo 循环） | 依赖已装 `@earendil-works/*`，未接 transport | 需 Provider Key |
| 推送 GitHub | remote 已配 | 网络连接 github.com 失败 |

## 下一步

1. 配置 LLM Key，用 Pi Agent SDK 替换 echo runner  
2. 本机 `npm run dev` 打开 Electron 做 UI 走查  
3. 网络恢复后 `git push -u origin feat/ecommerce-scenario-routing`  
4. ⑦ MCP / 电商业务实现（明确后置）

## 当前分支

- 分支：`feat/ecommerce-scenario-routing`
- 工作区：`D:\apos`
- remote：`https://github.com/RXQ6/Apos.git`
