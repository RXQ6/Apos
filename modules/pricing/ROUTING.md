# ROUTING — pricing

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `order.create` | `pricing.quote` | 下单前报价 | 同步，结果写入订单快照 | 支付时再算价 |
| `pricing.quote` | `catalog.get` | 基准价 | 同步查询 | 使用草稿价 |
| `pricing.quote` | `customer.get` | 会员/券资格 | 同步查询 | — |
| `payment.charge` | 订单报价快照 | 发起支付 | 读快照金额 | 调用 pricing 重算 |

## 对称性

`order`、`customer`、`payment` 侧 ROUTING 必须有对应行。
