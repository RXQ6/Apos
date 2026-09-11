# SCENARIO — payment.timeout_close

## 前置

- 支付单未成功且已超时

## 正常步骤

1. 关闭支付单
2. 联动 `order.timeout_cancel`

## 异常

- 与成功回调竞态：以先入账成功为准

## 后置

全链路一致关闭。
