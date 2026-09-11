# inventory.preoccupy

## 职责

在下单时为 SKU 预占库存，防止超卖；预占不等于实扣。

## 谁调用

- `order.create`（role: call）
- 场景：`order.create`

## 输入 / 输出

| 方向 | 字段 | 说明 |
|---|---|---|
| in | order_id / request_id | 幂等键来源 |
| in | items[]: sku_id, qty | 必须 > 0 |
| out | preoccupy_id | 预占单号 |
| out | expires_at | 默认 now+15m |
| fail | STOCK_INSUFFICIENT | 任一 SKU 不足则整体失败 |

## 失败与错误码

- `STOCK_INSUFFICIENT`
- `SKU_NOT_FOUND`
- `PREOCCUPY_CONFLICT`（重试冲突，可重试）

## 幂等 / 并发

- 幂等键：`request_id` 或 `order_id`
- 同 SKU 并发必须原子

## 禁止事项

- 支付前不得实扣
- 禁止无单据预占
