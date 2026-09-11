# MODULE — payment

## 职责

支付单生命周期：创建支付、渠道拉起、异步回调、超时关单、退款发起入口。

## 非职责

- 不决定订单是否履约（通知 `order`）
- 不直接改库存（经 `order` 或按 ROUTING 调 `inventory.deduct`，默认经订单域）
- 不做售后审核（`aftersale`）

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| payment.create | 创建支付单 | `methods/create.md` |
| payment.charge | 发起扣款/收银台 | 后续补 |
| payment.callback | 渠道回调 | `methods/callback.md` |
| payment.timeout_close | 支付超时关闭 | `methods/timeout_close.md` |
| payment.refund | 发起退款 | 后续补 |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| order | 订单金额与状态回写 |

## 状态与不变式

- 支付单：`created` → `paying` → `success` / `failed` / `closed`
- 回调必须幂等（渠道流水号）
- 订单应付金额以订单快照为准，禁止支付模块改价
