# SCENARIO — payment.callback

## 前置

- 存在待支付支付单/订单
- 渠道密钥已配置

## 正常步骤

1. 验签
2. 按 tx_id 幂等判断
3. `order.mark_paid`
4. 按 ROUTING 执行 `inventory.deduct`（或由订单域编排）
5. 返回渠道成功应答

## 异常

- 验签失败 → 记录并拒绝
- 金额不一致 → 不标记成功，告警

## 后置

订单 `paid`；库存实扣；进入履约路由。
