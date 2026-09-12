---
feature: scenario-closeout-all
status: delivered
updated: 2026-09-11
branch: feat/ecommerce-scenario-routing
commits: 74acac3..HEAD
---

# 全场景收口（40/40 passing）

## Report

**What was built** — 补齐 pricing（活动价>会员价>券）、coupon 表与领取/核销、order.repay/address_change、履约轨迹与部分发货完成判定；shop 扩展 me/地址/订单列表/repay/报价/领券/履约 REST；tools 补齐。全部 40 场景 harness=passing。

**Verification** — `npm.cmd run gate` PASS：verify **40/40 passing**；shared vitest **25/25**；shop 7/7；smoke sandbox-pay。

**Journey log**
- 部分发货：签收完成判定改为「已发运数量 ≥ 订单行数量」
- 报价规则固定 activity > member > coupon，写入 order snapshot
- 真渠道/安装包仍明确后置

## Tasks

- [x] T1 domain closeout + pricing
- [x] T2 shop REST + tools
- [x] T3 全场景 passing + gate
