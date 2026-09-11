# SCENARIO — inventory.preoccupy

## 前置

- 调用方持有 order request_id / 临时单号
- SKU 存在

## 正常步骤

1. 校验每 SKU `available >= qty`
2. 原子写入预占明细
3. 返回 `preoccupy_id`, `expires_at`

## 异常

- 任一 SKU 不足 → 整体失败 `STOCK_INSUFFICIENT`
- 重复 request_id → 返回原预占成功

## 后置

可售减少，预占增加；不改变 on_hand（除非库存模型将预占计入）。
