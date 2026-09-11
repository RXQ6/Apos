# SCENARIO — order.timeout_cancel

## 前置

- 订单仍为 `pending_payment`
- 超过 expire_at

## 正常步骤

1. 调度触发 `order.timeout_cancel` / `payment.timeout_close`
2. 订单 → `closed`
3. `inventory.release`

## 异常

- 若并发支付成功：以支付结果为准，关单失败并记日志

## 后置

预占释放；支付单 `closed`。
