# SCENARIO — payment.callback

## 前置

- 存在待支付支付单/订单（channel=`sandbox` 或已配置渠道）
- 渠道密钥已配置（沙箱默认密钥可覆盖 `payment.sandbox.secret`）

## 正常步骤

1. 收到渠道回调 `{ payload, signature }`
2. **验签**（HMAC-SHA256，规范串见 `modules/payment/methods/callback.md`）
3. 按 `channel_tx_id` 幂等判断
4. 校验金额与支付单一致
5. `order.mark_paid`
6. 按 ROUTING 执行 `inventory.deduct`（经订单域编排）
7. 返回渠道成功应答

沙箱模拟：`sandboxSettle` 生成流水并签名后走同一入口 `receiveChannelCallback`。

## 异常

- 验签失败 → `SIGN_INVALID`，记录并拒绝，不改状态/库存
- 金额不一致 → 不标记成功，告警
- 重复 `channel_tx_id` → 幂等返回已处理结果
- `FAILED` 标记支付失败、不扣库存；之后合法 SUCCESS 可覆盖（重试）

## 后置

订单 `paid`；库存实扣；进入履约路由。
