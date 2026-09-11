# SCENARIO — cart.checkout_ready

## 前置

- 购物车有勾选行

## 正常步骤

1. `cart.list`
2. 校验在售与数量
3. 产出 `checkout_batch_id`

## 后置

- `order.create` 必须携带 batch 或等价行快照
