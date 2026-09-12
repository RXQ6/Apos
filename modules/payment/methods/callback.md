# payment.callback

## 职责

处理渠道异步通知：验签、幂等入账、驱动 `order.mark_paid`（及按路由扣减）。

## 谁调用

- 支付渠道（沙箱：`sandboxSettle` → `receiveChannelCallback`）

## 输入

- `payload`：`paymentId, channelTxId, amountCents, status, timestamp, channel`
- `signature`：HMAC-SHA256 hex

## 签名规范串

字段顺序固定，`key=value` 行，`\n` 连接，密钥默认 `apos-sandbox-dev-secret`（可被 `payment.sandbox.secret` 覆盖）：

```text
amountCents=<int>
channel=sandbox
channelTxId=<string>
paymentId=<string>
status=SUCCESS|FAILED
timestamp=<ms>
```

## 输出

- 业务处理结果；对渠道返回成功应答（按渠道规范）

## 失败

- `SIGN_INVALID` / `UNKNOWN_PAYMENT` / `AMOUNT_MISMATCH`

## 幂等

- 渠道 `channelTxId` 唯一约束（SUCCESS）；重复回调返回已处理订单状态，不重复扣库存
- `FAILED` 回调不写 `payment_tx`；后续签名校验通过的 SUCCESS 可覆盖 failed（fail_retry 语义）

## 禁止

- 先改库存再验签
- 回调里重算价
- 绕过 `receiveChannelCallback` 直接入账（`paymentCallbackSuccess` 仅限验签后内部调用）
