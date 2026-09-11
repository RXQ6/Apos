# order.create

## 职责

校验在售与地址，报价写入快照，预占库存，落单进入 `pending_payment`。

## 谁调用

- 前端结算
- 场景：`order.create`

## 输入 / 输出

| in | customer_id, address_id, items[], coupon_id? |
| out | order_id, pay_amount, expire_at |

## 依赖方法

- `catalog.get`
- `inventory.preoccupy`
- `pricing.quote`
- `customer.get` / address

## 失败

- `ITEM_OFF_SHELF` / `STOCK_INSUFFICIENT` / `PRICE_CHANGED` / `ADDRESS_INVALID`

## 幂等

- 客户端 `request_id` 防重复下单

## 禁止

- 先落单后预占且无补偿
- 支付时重算价覆盖快照
