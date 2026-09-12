# SCENARIO — payment.timeout_close

## 前置

- 支付单未成功且已超时（或订单 `expire_at` 已过）

## 正常步骤

1. 关闭支付单（`created`/`paying`/`failed` → `closed`）
2. 联动 `order.timeout_cancel`（释放预占，订单 `closed`）

调度入口：`sweepTimeoutOrders`；单笔：`paymentTimeoutClose`。

## 异常

- 与成功回调竞态：**先入账成功为准**
  - 先 SUCCESS → timeout 见 success，不关单
  - 先 closed → 后续 SUCCESS 回调 `PAYMENT_CLOSED`，不扣库存

## 后置

全链路一致关闭；预占释放可售恢复。
