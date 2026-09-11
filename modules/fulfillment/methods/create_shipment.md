# fulfillment.create_shipment

## 职责

对已支付订单创建发货单。

## 谁调用

- `order.mark_paid` 路由 / 仓配

## 输入

- order_id, items[]（子集则部分发货）

## 输出

- shipment_id

## 禁止

- 未支付创建
