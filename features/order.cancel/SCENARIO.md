# SCENARIO — order.cancel

## 正常步骤

1. 订单中心点取消
2. 状态 `cancelled`
3. `inventory.release`
4. 关闭支付单（若有）

## 异常

- 已支付 → 拒绝，引导售后
