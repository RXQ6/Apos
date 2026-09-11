# payment.callback

## 职责

处理渠道异步通知：验签、幂等入账、驱动 `order.mark_paid`（及按路由扣减）。

## 谁调用

- 支付渠道

## 输入

- channel, tx_id, payment_id/order_no, status, raw payload

## 输出

- 业务处理结果；对渠道返回成功应答（按渠道规范）

## 失败

- `SIGN_INVALID` / `UNKNOWN_PAYMENT` / `ALREADY_PROCESSED`

## 幂等

- 渠道 tx_id 唯一约束

## 禁止

- 先改库存再验签
- 回调里重算价
