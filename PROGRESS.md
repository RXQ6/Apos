# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 场景/Harness/契约/选型 | verify PASS | 39 features / 9 modules |
| 全域 domain 运行时 + Electron 工作台 | smoke + vitest 5/5 + app ready | packages/shared + apps/electron |
| A–D 落地路径、E 后置 | PROGRESS/DECISIONS | 已推送 GitHub |
| Electron 启动修复（内嵌 schema、renderer 路径） | main 无 FILE_NOT_FOUND | `497866d` |
| Provider 设置 + AES credentials | smoke KEY PATH OK | main IPC |
| Git 与 origin 同步 | status clean | `497866d` |

## 进行中

| 项 | 状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步（二选一，用户拍板）

1. **A 真支付沙箱** 替换 mock 回调  
2. **B HTTP API + 最小购物前台**  
3. 用户本机：模型设置填 API Key，点通 UI 与 LLM  
4. 可选：electron-builder 安装包  

## 当前分支

- `feat/ecommerce-scenario-routing` @ `497866d`
- 远程：`https://github.com/RXQ6/Apos.git`
- 工作区：`D:\apos`
- 门禁：`npm run verify && npm run smoke && npm test`
- Electron：`npm run build:shared && npm run build -w @apos/electron` 后启动 dist/main
- 镜像：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
