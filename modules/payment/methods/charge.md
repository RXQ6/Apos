# payment.charge

## 职责

拉起渠道扣款/收银台，进入 `paying`。

## 谁调用

- 场景 `payment.charge`

## 输入

- payment_id 或 order_id, channel

## 输出

- channel_payload（跳转参数/客户端参数）

## 失败

- `AMOUNT_MISMATCH` / `CHANNEL_UNAVAILABLE` / `ORDER_NOT_PAYABLE`

## 禁止

- 改订单应付金额
- 无支付单直接成功
