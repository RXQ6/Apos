# SCENARIO — order.create

## 前置

- 买家已登录（`customer.login`）
- 已 `cart.checkout_ready` 得到 checkout_batch

## 正常步骤

1. 携带 `checkout_batch_id` 或勾选行
2. `catalog.get` 校验 SKU 均为 `on_shelf`
3. `customer.get` 校验地址归属
4. `pricing.quote` 得到 `pay_amount` 与 `snapshot_id`
5. `inventory.preoccupy` 预占成功
6. 落单 `pending_payment`，写入报价快照
7. `payment.create`（可同步或下一步）
8. 成功后清购物车已购行

## L3 走读记录（2026-09-11）

- ROUTING：order↔cart/catalog/inventory/pricing/customer/payment 对称存在
- 契约：`docs/contracts/p0-contracts.md` POST `/orders`
- 旅程剧本步骤 5 覆盖本场景
- `docs:verify` 通过 → harness `passing`

## 异常分支

| 条件 | 处理 | 错误码 |
|---|---|---|
| SKU 下架 | 终止 | ITEM_OFF_SHELF |
| 库存不足 | 终止并确保无预占残留 | STOCK_INSUFFICIENT |
| 地址非法 | 终止 | ADDRESS_INVALID |

## 后置状态

- 订单：`pending_payment`
- 库存：预占
- 支付单：`created`（若已创建）

## 验收点

见 `feature.json` → `acceptance`。
