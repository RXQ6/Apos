# inventory.deduct

## 职责

支付成功后将预占转为实扣，减少可售库存。

## 谁调用

- `payment.callback` →（经 order 或按 Spec 直调）
- 场景：`payment.callback`

## 输入 / 输出

| 方向 | 字段 |
|---|---|
| in | preoccupy_id 或 order_id（幂等） |
| in | items[] sku_id, qty |
| out | deduct_id, remaining_on_hand |

## 失败

- `PREOCCUPY_NOT_FOUND` / `ALREADY_DEDUCTED`（幂等成功）

## 幂等 / 并发

- 同一 preoccupy_id 重复 deduct 返回已扣成功

## 禁止事项

- 未预占直接扣减（除非明确的无预占模式，需 Spec）
- 与 release 同一预占单并发无锁
