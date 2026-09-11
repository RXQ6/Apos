# ROUTING — payment

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `order.create` | `payment.create` | 待支付 | 同步创建支付单 | 无订单号建支付单 |
| `payment.callback` | `order.mark_paid` | 渠道成功通知 | 幂等 | 先发货再记账 |
| `payment.callback` | `inventory.deduct` | 可选直扣 | 仅当 Spec 明确；默认经 order | 无订单关联扣库存 |
| `payment.timeout_close` | `order.timeout_cancel` | 关单 | 联动 | 只关支付不关订单 |
| `aftersale.approve` | `payment.refund` | 退款 | 带售后单号 | 无售后单退款 |

## 对称性

order / inventory / aftersale 对称登记。
