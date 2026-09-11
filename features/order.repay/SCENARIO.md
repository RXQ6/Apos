# SCENARIO — order.repay

## 正常步骤

1. `order.get` 确认可支付
2. 路由到 `payment.charge`

## 禁止

- closed/cancelled/paid 订单重付
