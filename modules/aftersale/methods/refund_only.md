# aftersale.refund_only

## 职责

仅退款结案：调用 `payment.refund`，不入库。

## 谁调用

- 审核通过后

## 输入

- aftersale_id

## 输出

- refund_id, aftersale closed

## 禁止

- 金额超实付
- 重复退款无幂等
