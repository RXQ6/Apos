# aftersale.open

## 职责

对订单行创建售后单并校验可售后条件。

## 谁调用

- 用户端；场景 `aftersale.refund_only` 等

## 输入

- order_id, order_line_id, type, reason, amount?

## 输出

- aftersale_id, status=`opened`

## 依赖

- `order.get`

## 禁止

- 未支付/未售后窗口外仍强制成功（应业务规则拒绝）
