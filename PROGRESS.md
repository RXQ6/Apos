# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| A 产品：Pi bridge + 设置保存 + 会话恢复 + 权限 | 代码接线 | `pi-bridge.ts` / main IPC / 设置 UI |
| B 业务：cart/customer/catalog/payment/fulfillment/aftersale | domain + tools | `packages/shared/src/domain/` |
| C 质量：Vitest 5 用例 + smoke + verify | PASS | `vitest` / `smoke-domain` / verify |
| D 工程：CI workflow + gate 脚本 + main 日志 | 文件存在 | `.github/workflows/ci.yml` |
| 场景 harness：**18 passing**（运行时已覆盖） | verify | features=39 passing=18 |
| E 后置范围 | 文档 | tech-stack / 本文件 |

## 进行中

| 项 | 状态 |
|---|---|
| 真实 Provider Key 的 LLM 联调 | 代码就绪，待本机填 Key |
| Electron UI 人工走查 | 待 `npm run dev` |
| electron-builder 安装包 | 脚本占位，未配置完整打包 |

## 明确后置（E）

- MCP Sources、远程 headless server、CLI  
- 秒杀/跨境/分账/风控  
- 优惠券复杂规则引擎、多仓  

## 下一步

1. `npm run gate` 全绿后 push  
2. 设置页填 Key，新会话试 LLM  
3. 需要安装包时再加 electron-builder  

## 当前分支

- `feat/ecommerce-scenario-routing` → `https://github.com/RXQ6/Apos.git`
