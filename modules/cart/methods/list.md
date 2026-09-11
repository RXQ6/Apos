# cart.list

## 职责

返回购物车行、失效标记、可选可售提示与预览价。

## 谁调用

- 购物车页；`cart.checkout_ready`

## 输出

- lines[]: sku, qty, checked, invalid_reason?, preview_price?

## 禁止

- 把 preview_price 当作支付金额
