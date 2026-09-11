# cart.update

## 职责

修改行数量、勾选状态或删除行。

## 谁调用

- 场景 `cart.update`（可并入 `cart.add` 卡的变体，独立方法契约）

## 输入

- cart_id, line_id, qty?, checked?, remove?

## 禁止

- 越权改他人购物车
