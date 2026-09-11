# ROUTING — fulfillment

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `order.mark_paid` / 事件 | `fulfillment.create_shipment` | 履约启动 | 事件或同步指令 | 未支付发货 |
| `fulfillment.ship` | `order` 状态更新 | 发货成功 | 通过 order 入口回写 | 仓库直接 UPDATE 订单 |
| `fulfillment.ship` | `catalog.get` | 打单 | 只读 | — |
| `fulfillment.sign` | `order` completed | 签收 | 回写 | — |
| `aftersale.return` | `fulfillment` 收货 | 退货仓收货 | 事件 | 售后改物流轨迹 |

## 对称性

order / catalog / aftersale 对称。
