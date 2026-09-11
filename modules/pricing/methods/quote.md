# pricing.quote

## 职责

计算订单行与订单应付金额，产出不可变报价快照。

## 谁调用

- `order.create`

## 输入

- items[], customer_id, coupon_id?, campaign_ids?

## 输出

- line_totals[], discount_detail[], pay_amount, snapshot_id

## 依赖

- `catalog.get`, `customer.get`

## 禁止

- 支付阶段再次 quote 覆盖订单快照
