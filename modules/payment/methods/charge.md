# payment.charge

## 职责

拉起渠道扣款/收银台，进入 `paying`。

## 谁调用

- 场景 `payment.charge`

## 输入

- payment_id 或 order_id, channel（默认 `sandbox`）

## 输出

- channel_payload：沙箱返回 `sandboxPayUrl`（`sandbox://pay/<paymentId>`）、`amountCents`、`channel`
- 完成支付走 `sandboxSettle` → 签名回调 `receiveChannelCallback`

## 失败

- `AMOUNT_MISMATCH` / `CHANNEL_UNAVAILABLE` / `ORDER_NOT_PAYABLE` / `PAYMENT_ALREADY_SUCCESS`（已关单）

## 禁止

- 改订单应付金额
- 无支付单直接成功
