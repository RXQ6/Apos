---
feature: shop-http-storefront
status: delivered
updated: 2026-09-11
branch: feat/ecommerce-scenario-routing
commits: 3f83dc3..HEAD
---

# Hono HTTP API + 最小购物前台

## Report

**What was built** — 新增 `apps/shop`（`@apos/shop`）：Hono 服务暴露 P0 电商 API（鉴权/目录/购物车/订单/支付/沙箱 settle），并托管 `public/index.html` 最小前台，可完成种子商品 → 登录加购 → 下单 → 沙箱支付 → 订单 paid。评审 critical 已修：游客车登录合并、下单清车、订单/支付属主校验、schema `domain:shop`、验收文案对齐。

**Verification** — `npm.cmd run gate` PASS：verify 40 features / 19 passing；shared vitest 10/10；shop vitest 7/7。

**Journey log**
- 路由对齐 contracts，业务走 shared domain
- 游客可加购；创建订单强制 Bearer；登录带 X-Guest-Id 触发 cartMerge
- 下单 fromCart 后 cartClearChecked；订单/支付写接口校验 customerId
- 前台单页足够验收，未上 React

## [S1] Problem

Domain 内核与支付沙箱已可跑，但只有 Electron 工具/代码调用。缺少对外 HTTP 与买家可点的最小闭环：商品 → 购物车 → 下单 → 沙箱支付。

## [S2] Design

新增 workspace `apps/shop`（`@apos/shop`）：

- **API**：Hono + `@hono/node-server`，进程内 `openAposDb`，复用 `@apos/shared` domain
- **前台**：`public/index.html` 单页，由同一服务静态托管
- **鉴权**：`Authorization: Bearer <sessionToken>`；游客购物车用 `X-Guest-Id`
- **错误**：`{code,message}`，DomainError 映射 4xx

### 本阶段路由（P0 最小闭环）

| Method | Path | 映射 |
|---|---|---|
| GET | `/api/health` | liveness |
| POST | `/api/auth/register` | customer.register |
| POST | `/api/auth/login` | customer.login |
| GET | `/api/catalog/search` | catalog.search |
| GET | `/api/catalog/spus/:id` | catalog.detail |
| GET | `/api/cart` | cart load |
| POST | `/api/cart/items` | cart.add |
| PATCH | `/api/cart/items/:lineId` | cart.update |
| DELETE | `/api/cart/items/:lineId` | cart.update remove |
| POST | `/api/cart/checkout-ready` | cart.checkout_ready |
| POST | `/api/orders` | order.create（lines 或 checked cart） |
| GET | `/api/orders/:id` | order.get |
| POST | `/api/orders/:id/cancel` | order.cancel |
| POST | `/api/payments` | payment.create |
| POST | `/api/payments/:id/charge` | payment.charge |
| POST | `/api/payments/callback` | payment.callback（HMAC） |
| POST | `/api/payments/:id/sandbox-settle` | sandboxSettle（演示） |
| POST | `/api/admin/seed-demo` | 演示商品种子（dev） |

### 前台流程

1. 列表/搜索商品 → 详情  
2. 加购 → 购物车改数量  
3. 登录/注册（或游客）→ 结算 → 创建订单  
4. 发起支付 → 沙箱 settle → 订单 paid  

## [S3] Out of Scope

- 生产鉴权加固、HTTPS、CORS 复杂策略
- 完整管理后台、优惠券 UI
- Electron 内嵌此服务（可后续接）

## Tasks

- [x] T1: Spec + 契约标注 shop 落地 — acceptance: 本文档 + contracts 有 shop 路由说明 (covers: S2)
- [x] T2: apps/shop Hono API — acceptance: createApp 可测；health/catalog/cart/order/pay 路由可调 (covers: S2; depends: T1)
- [x] T3: public 最小前台 — acceptance: 单页可完成加购→下单→沙箱支付 (covers: S2; depends: T2)
- [x] T4: vitest 覆盖主路径 + gate — acceptance: API 测试通过且 gate PASS (covers: S2; depends: T2)
