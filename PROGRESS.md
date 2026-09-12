# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 全场景 40/40 + domain/shop 测试 | gate PASS | feature-list |
| **纯网页主产品** | `/workbench` + `/` | `npm.cmd run web` |
| 支付沙箱 / 超时重试 / 报价券 | vitest | packages/shared |
| Electron | 仅可选桌面壳 | apps/electron |

## 进行中

| 项 | 状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步

1. 浏览器打开 `http://127.0.0.1:8787/workbench` 使用  
2. 可选：真支付商户密钥  
3. 可选：部署到服务器（Node + 反代）  

## 当前分支

- `feat/ecommerce-scenario-routing`
- 主命令：`npm.cmd run web` → 8787
