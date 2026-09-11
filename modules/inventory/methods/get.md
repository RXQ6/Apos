# inventory.get

## 职责

查询 SKU 可售、预占、在途数量。

## 谁调用

- `catalog.publish`, `order.create`（校验）, 运营后台

## 输入 / 输出

| in | sku_id 或 sku_ids[] |
| out | available, preoccupied, on_hand |

## 禁止

- 未鉴权暴露全量库存
