# payment.timeout_close

## 职责

支付单超时关闭，并联动订单关单与库存释放。

## 谁调用

- 调度

## 输入

- payment_id

## 输出

- payment closed; order timeout_cancel

## 禁止

- 支付已成功仍关单
