# order.cancel

## 职责

买家主动取消待支付订单。

## 输入

- order_id, customer_id, reason

## 幂等

- 已取消返回成功

## 禁止

- 已支付订单直取消
