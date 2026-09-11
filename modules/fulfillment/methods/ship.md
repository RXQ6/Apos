# fulfillment.ship

## 职责

绑定运单号并标记发货，回写订单履约状态。

## 谁调用

- 仓配系统

## 输入

- shipment_id, carrier, tracking_no

## 输出

- shipped_at; order → fulfilling

## 幂等

- 同 shipment_id 重复 ship 忽略

## 禁止

- 无 shipment 发货
