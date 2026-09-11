# SCENARIO — inventory.deduct

## 前置

- 支付成功回调已验签；存在 active 预占

## 正常步骤

1. `order.mark_paid`
2. `inventory.deduct(preoccupy_id)`
3. 预占 → deducted

## 禁止

- 重复扣减；未预占直接减 on_hand（除非 Spec 特批）
