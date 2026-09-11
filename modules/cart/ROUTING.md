# ROUTING — cart

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `cart.add` | `catalog.get` | 校验 SKU | 同步只读 | 加购草稿 SKU |
| `cart.list` | `inventory.get` | 展示可售提示 | 可选只读 | 在购物车锁库存 |
| `cart.checkout_ready` | `cart.list` + `catalog.get` | 冻结勾选 | 同步 | 未校验直接下单 |
| `order.create` | `cart.checkout_ready` | 结算入口 | 必须先 ready | 绕过 cart 直接建单（API 可显式 buy-now 但需走 order 同一校验） |
| `order.create` 成功 | `cart` 清行 | 下单完成 | 删除已购行 | — |
| `customer.login` | `cart.merge` | 登录合并 | 幂等合并 | 静默丢游客车 |

## 对称性

order / catalog / inventory / customer / pricing 必须有对应行。
