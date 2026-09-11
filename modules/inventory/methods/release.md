# inventory.release

## 职责

取消订单或预占超时后释放预占，恢复可售。

## 谁调用

- `order.timeout_cancel`
- `aftersale` 结案回补（部分场景）

## 输入 / 输出

| 方向 | 字段 |
|---|---|
| in | preoccupy_id（幂等） |
| out | released: true |

## 失败

- `PREOCCUPY_NOT_FOUND`（若已释放可视为成功）

## 禁止事项

- 无预占单盲目加库存
