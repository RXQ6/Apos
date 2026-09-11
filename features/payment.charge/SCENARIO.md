# SCENARIO — payment.charge

## 前置

- 订单 `pending_payment`，存在支付单或可创建

## 正常步骤

1. 选择支付方式
2. `payment.charge` 拉起渠道
3. 状态 `paying`
4. 等待 `payment.callback` 或前端同步结果

## 异常

- 用户取消 → 仍 `pending_payment` 可重试
- 渠道失败 → `failed` 可重试
- 超时 → `payment.timeout_close`
