# SCENARIO — payment.fail_retry

## 前置

- 订单仍 `pending_payment`（预占保留）
- 存在 `failed` 支付单，或可新建支付单

## 正常步骤

1. 渠道失败 → 支付单 `failed`（`paymentFail` / FAILED 回调）
2. 再次 `payment.charge`（failed → paying）或 `payment.create` 新单
3. 新渠道流水 SUCCESS 入账；旧失败流水不入账、不双扣

## 禁止

- 已 `success` 的支付单再次成功扣款
- 订单非 `pending_payment` 时 charge/重试

## 后置

成功一次后订单 `paid`；库存只扣一次。
