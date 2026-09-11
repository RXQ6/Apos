# aftersale.return_refund

## 职责

推进退货退款状态机：收货前不退款，收货后回库+退款。

## 谁调用

- 场景 `aftersale.return_refund`；仓配事件

## 步骤契约

1. open → approve
2. 用户寄回
3. return_received 事件
4. inventory 回补（幂等）
5. payment.refund
6. closed

## 禁止

- 未收货退款；重复回库
