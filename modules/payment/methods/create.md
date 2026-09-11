# payment.create

## 职责

按订单快照金额创建支付单。

## 谁调用

- `order.create` 后置或同步子步骤

## 输入

- order_id, amount（必须=订单快照）, channel?

## 输出

- payment_id, cashier_payload

## 失败

- `AMOUNT_MISMATCH` / `ORDER_NOT_PAYABLE`

## 禁止

- 无订单号创建
