# ROUTING — inventory

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `order.create` | `inventory.preoccupy` | 创建订单 | 同步，失败则订单不落库 | 订单服务直接 UPDATE 库存 |
| `order.timeout_cancel` | `inventory.release` | 超时关单 | 幂等释放 | 只改订单不释放库存 |
| `payment.callback` | `inventory.deduct` | 支付成功 | 幂等扣减 | 重复扣减无幂等键 |
| `aftersale.refund_only` | `inventory.release` 或补回 | 售后结案 | 按是否已扣减分支 | 无单据盲补库存 |
| `catalog.publish` | `inventory.get` | 上架 | 查询 | — |

## 对称性

调用方 `order` / `payment` / `aftersale` / `catalog` 的 ROUTING 必须对称。
