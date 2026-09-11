# order.timeout_cancel

## 职责

未支付超时关单：状态 `closed`/`cancelled`，并 `inventory.release`。

## 谁调用

- 调度 / `payment.timeout_close` 联动

## 输入

- order_id, reason=timeout

## 幂等

- 已关闭订单再调返回成功

## 禁止

- 只关单不释放库存
