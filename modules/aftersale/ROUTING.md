# ROUTING — aftersale

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `aftersale.open` | `order.get` | 校验 | 只读 | 无订单开售后 |
| `aftersale.approve` | `payment.refund` | 退款 | 幂等带售后单号 | 绕过售后直接退款 |
| `aftersale.return_refund` | `fulfillment` 收货事件 | 回库前 | 事件 | 跳过收货退款 |
| `aftersale.return_refund` | `inventory` 回补 | 收货成功 | 幂等回库 | 重复回库 |
| `aftersale.refund_only` | `payment.refund` | 仅退款 | 带金额上限校验 | — |

## 对称性

order / payment / inventory / fulfillment 对称。
