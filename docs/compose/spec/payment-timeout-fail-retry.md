---
feature: payment-timeout-fail-retry
status: delivered
updated: 2026-09-11
branch: feat/ecommerce-scenario-routing
commits: d627207..HEAD
---

# 超时关单 + 支付失败重试

## Report

**What was built** — `sweepTimeoutOrders` 统一关闭过期待支付订单（关支付+释放预占）；`paymentCallbackSuccess`/`sandboxSettle` 拒绝 closed 支付（`PAYMENT_CLOSED`）；timeout 幂等；failed 可 re-charge 重试。tools + shop API 暴露 timeout-close / sweep。

**Verification** — `npm.cmd run gate` PASS：verify 40/**22 passing**；shared vitest **15/15**；shop 7/7。

**Journey log**
- 先 SUCCESS 后 timeout：不关单；先 closed 后 SUCCESS：`PAYMENT_CLOSED` 不扣库存
- fail_retry 不改订单预占，只换支付流水
- `PAYMENT_ALREADY_SUCCESS` 与 `PAYMENT_CLOSED` 分开，便于前端分支

## [S1] Problem

`payment.timeout_close` / `order.timeout_cancel` / `payment.fail_retry` 均为 P0 `not_started`。domain 已有零散函数（`paymentTimeoutClose`、`expirePreoccupies`、`paymentFail`），但缺少：

- 统一超时扫描（订单+支付+预占一致关闭）
- 成功回调与关单竞态：关单后仍可能 SUCCESS 入账
- 失败后重试路径的验收与工具/API 暴露

## [S2] Design

### 超时关单

新增 `sweepTimeoutOrders(db, at = now())`：

1. 找出 `orders.status='pending_payment' AND expire_at <= at`
2. 对每单：非 success 支付单 → `closed`；`cancelOrder(..., 'timeout')` 释放预占 → `closed`
3. 幂等：已 closed/cancelled/paid 不再处理

`paymentTimeoutClose(db, paymentId)` 保持单笔入口；已 success 抛 `PAYMENT_ALREADY_SUCCESS`；已 closed 幂等返回。

### 竞态

`paymentCallbackSuccess` / `sandboxSettle`：支付单 `closed` → `PAYMENT_CLOSED`，不 mark_paid、不扣库存。  
先 SUCCESS 再 timeout：timeout 见 success → 不关。

### 失败重试

- `paymentFail` 后订单仍 `pending_payment`，预占保留
- `chargePayment` 允许 `failed` → `paying`（同单重试）
- 无 `created/paying` 时 `createPayment` 可开新支付单
- 旧 FAILED 流水不入账；仅 SUCCESS 走 `payment_tx` 幂等

### 暴露

- tools：`payment_timeout_close`、`order_timeout_sweep`
- shop：`POST /api/payments/:id/timeout-close`、`POST /api/admin/sweep-timeouts`

## [S3] Out of Scope

- 分布式调度器 / 延迟队列
- 部分关单、部分释放

## Tasks

- [x] T1: 更新三场景 SCENARIO + 竞态说明 — acceptance: 文档含 sweep/竞态/重试语义 (covers: S2)
- [x] T2: domain sweep + closed 拒收 + timeout 幂等 — acceptance: vitest 覆盖 timeout/竞态/重试 (covers: S2; depends: T1)
- [x] T3: tools + shop 路由 — acceptance: API 可 sweep；工具可调用 (covers: S2; depends: T2)
- [x] T4: gate + feature passing + 交接 — acceptance: gate PASS 且三场景 harness=passing (covers: S2; depends: T2, T3)
