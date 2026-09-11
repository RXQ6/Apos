# order.mark_paid

## 职责

将订单从 `pending_payment` 迁到 `paid`，并触发履约与库存扣减路由。

## 谁调用

- `payment.callback`（幂等）

## 输入

- order_id, payment_id, channel_tx_id

## 输出

- 状态 `paid`, 事件 `order.paid`

## 幂等

- 同 channel_tx_id / order_id 重复成功回调忽略

## 禁止

- 未支付金额不一致仍标记成功
