# ROUTING — catalog

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `catalog.publish` | `inventory.get` | 上架前可售检查 | 同步查询 | 直接改库存表 |
| `order.create` | `catalog.get` | 下单校验在售 | 同步查询 | 读未发布草稿 |
| `pricing.quote` | `catalog.get` | 取售价基准 | 同步查询 | 使用下架价 |
| `fulfillment.ship` | `catalog.get` | 取商品属性打单 | 同步查询 | — |

## 对称性

调用方 `order`/`pricing`/`fulfillment` 的 `ROUTING.md` 必须有对应行。
