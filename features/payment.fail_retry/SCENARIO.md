# SCENARIO — payment.fail_retry

## 正常步骤

1. 订单仍 pending_payment
2. 再次 `payment.charge`
3. 新渠道流水；旧失败流水不入账

## 禁止

- 已 success 的支付单再次 charge 成功
