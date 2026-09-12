# SCENARIO — order.timeout_cancel

## 前置

- 订单仍为 `pending_payment`
- 超过 `expire_at`（或显式 timeout 关单）

## 正常步骤

1. `sweepTimeoutOrders` / `paymentTimeoutClose` 触发
2. 关联非 success 支付单 → `closed`
3. 订单 → `closed`
4. `inventory.release`（预占释放）

## 异常

- 若已支付成功：不关单、不释放（`PAYMENT_ALREADY_SUCCESS` / sweep 跳过）
- 重复调度幂等

## 后置

预占释放；支付单 `closed`；可售恢复。
