# ROUTING — order

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `order.create` | `catalog.get` | 在售校验 | 同步 | 读草稿 |
| `order.create` | `inventory.preoccupy` | 锁库存 | 同步，失败不落单 | 先落单后扣 |
| `order.create` | `pricing.quote` | 算价 | 同步，写快照 | — |
| `order.create` | `customer.get` | 收货地址 | 同步 | — |
| `order.create` | `payment.create` | 生成支付单 | 异步/后续步骤可拆 | 支付模块反向创建订单 |
| `payment.callback` | `order.mark_paid` | 支付成功 | 幂等状态迁移 | 重复发货 |
| `order.timeout_cancel` | `inventory.release` | 释放 | 幂等 | — |
| `order.paid` | `fulfillment.create_shipment` | 履约 | 出站事件或同步指令 | 仓库直改订单状态绕过 |
| `aftersale.open` | `order.get` | 售后读单 | 只读 | 售后直接改主状态不记单 |

## 对称性

payment / inventory / fulfillment / aftersale / customer 均需对称行。
