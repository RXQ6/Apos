# SCENARIO — order.create

## 前置

- 买家已登录（`customer.login`）
- 购物车/结算页商品可选

## 正常步骤

1. 调用 `catalog.get` 校验 SKU 均为 `on_shelf`
2. 调用 `customer.get` 校验地址归属
3. 调用 `pricing.quote` 得到 `pay_amount` 与 `snapshot_id`
4. 调用 `inventory.preoccupy` 预占成功
5. 调用 `order.persist/create` 落单为 `pending_payment`，写入报价快照
6. 创建 `payment.create` 支付单（可同请求或下一步）

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
