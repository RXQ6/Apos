# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 文档域 + Harness + 选型 + 契约 | verify | 既有 |
| 工程①–⑥ + 推送 GitHub | commits | origin/RXQ6/Apos |
| 闭环缺口补卡：cart.update/merge、inventory.deduct/release、payment.fail_retry、order.repay、logout、track、approve、coupon_receive | feature-list | 本批 |
| 方法 MD：approve/return_refund/track/logout/coupon_* | modules/*/methods | 本批 |
| Agent 产品场景：workbench、provider_config + AES 凭证层 | features/agent.* + credentials.ts | 本批 |
| order.create L3 走读 | harness=passing | SCENARIO 走读记录 |

## 进行中

| 项 | 当前状态 | 阻塞 |
|---|---|---|
| （无 active 功能项） | — | — |

## 下一步

1. 本机 `npm run dev` UI 走查；配 Key 后接 Pi 替换 echo  
2. 按 feature-list 顺序推进 `agent.workbench` → `passing`  
3. ⑦ MCP / 电商业务运行时实现  

## 当前分支

- `feat/ecommerce-scenario-routing` → `https://github.com/RXQ6/Apos.git`
- 工作区：`D:\apos`
