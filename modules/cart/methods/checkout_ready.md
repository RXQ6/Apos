# cart.checkout_ready

## 职责

校验勾选行均在售且数量合法，生成结算批次（checkout_batch_id），供 `order.create` 使用。

## 谁调用

- 结算页；`order.create` 前置

## 输入

- cart_id, line_ids[]

## 输出

- checkout_batch_id, lines[]

## 失败

- `CART_EMPTY` / `LINE_INVALID` / `ITEM_OFF_SHELF`

## 禁止

- 无 batch 直接建单导致购物车与订单行不一致
