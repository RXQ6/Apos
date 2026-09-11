# payment.refund

## 职责

按售后单发起原路退款。

## 谁调用

- `aftersale.refund_only` / `aftersale.return_refund`（收货后）

## 输入

- aftersale_id, payment_id, amount_cents

## 输出

- refund_id, status

## 失败

- `AMOUNT_EXCEEDS_PAID` / `ALREADY_REFUNDED`（幂等成功） / `CHANNEL_ERROR`

## 禁止

- 无售后单退款
- 退货退款在 return_received 之前调用
