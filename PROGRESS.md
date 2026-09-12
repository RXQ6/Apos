# PROGRESS.md — 进度持久化

> 会话结束前必须更新。新会话只读本文件 + `DECISIONS.md` + `AGENTS.md` 即可接班。

## 已完成

| 项 | 验收 | 证据 |
|---|---|---|
| 全场景 40/40 passing | verify PASS | feature-list |
| **Electron 内嵌小店** | esbuild + IPC open-shop | apps/electron main |
| **支付渠道适配层** | vitest channels 4 | payment-channels.ts |
| **前台地址/券/物流** | 单页 UI | apps/shop/public |
| **安装包脚本 + README** | electron-builder.yml | `npm.cmd run dist:electron` |

## 进行中

| 项 | 状态 | 阻塞 |
|---|---|---|
| （无） | — | — |

## 下一步（可选）

1. 真实商户密钥写入 `payment.alipay.config` / `payment.wechat.config`  
2. 本机执行 `npm.cmd run dist:electron` 产出安装包  
3. Electron 生产环境打包 shop public 路径微调  

## 当前分支

- `feat/ecommerce-scenario-routing`
- 门禁：`npm.cmd run gate`
- 小店：Electron 内嵌或 `npm.cmd run shop`
