---
feature: productize-shell
status: delivered
updated: 2026-09-11
branch: feat/ecommerce-scenario-routing
commits: dcf5c14..HEAD
---

# 产品化外壳：Electron 内嵌小店 + 渠道适配 + 安装包说明

## Report

**What was built** — Electron 启动时内嵌 Hono shop（「打开小店」窗口）；支付渠道适配层（sandbox 默认，alipay/wechat 预留凭据配置）；前台补地址/领券/物流轨迹；README 部署与 electron-builder 脚本。

**Verification** — shared vitest 29/29（含 channels 4）；shop 7/7；electron esbuild 成功；gate 见提交。

**Journey log**
- 真渠道需商户密钥，适配层只到 charge/cashier 占位
- 安装包脚本已备，首次 dist 需下载 Electron 发行物

## Tasks

- [x] Electron startShopServer + open-shop IPC
- [x] payment-channels adapter
- [x] storefront address/coupon/track
- [x] electron-builder.yml + README
