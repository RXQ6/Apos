# order.change_address

## 职责

在 `pending_payment` 状态修改订单收货地址。

## 谁调用

- 场景 `order.address_change`（define）

## 输入

- order_id, address_id
- 当前会话 customer_id（鉴权）

## 输出

- 更新后的收货快照

## 失败

- `ORDER_NOT_EDITABLE`（已支付/已关闭）
- `FORBIDDEN`（非本人）
- `ADDRESS_INVALID`

## 幂等 / 并发

- 同一订单并发改址以最后一次成功写入为准（需版本号或乐观锁）

## 禁止

- 已支付订单直改地址（应走售后/拦截）
- 未校验地址归属
