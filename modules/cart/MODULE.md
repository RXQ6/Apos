# MODULE — cart

## 职责

购物车：加购、改量、勾选结算、失效商品处理、登录合并；为 `order.create` 提供 `cart_ready`。

## 非职责

- 不算最终成交价快照（`pricing` 在结算时 quote）
- 不预占库存（下单时才 `inventory.preoccupy`）
- 不创建订单（`order`）

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| cart.add | 加入购物车 | `methods/add.md` |
| cart.update | 改数量/勾选 | `methods/update.md` |
| cart.list | 购物车列表 | `methods/list.md` |
| cart.checkout_ready | 校验可结算并冻结勾选行 | `methods/checkout_ready.md` |
| cart.merge | 游客车合并到登录用户 | `methods/merge.md` |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| catalog | SKU 在售与基础信息 |
| inventory | 可选：加购时展示可售提示（不锁库） |
| customer | 归属用户；登录合并 |
| pricing | 结算预览（非权威快照） |

## 状态与不变式

- 行状态：`active` / `invalid`（下架/无货）/ `checked`
- 仅 `checked` 行可进入 `checkout_ready`
- 购物车不保证成交时有货；以 `order.create` 预占为准
