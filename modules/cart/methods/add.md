# cart.add

## 职责

将 SKU 加入当前用户（或游客）购物车。

## 谁调用

- 场景 `cart.add`

## 输入

- customer_id 或 guest_id, sku_id, qty

## 输出

- cart_id, line_id, line_state

## 依赖

- `catalog.get`

## 失败

- `SKU_NOT_FOUND` / `ITEM_OFF_SHELF` / `QTY_INVALID`

## 禁止

- 加购时锁库存
