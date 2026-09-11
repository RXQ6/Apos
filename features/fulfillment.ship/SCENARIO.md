# SCENARIO — fulfillment.ship

## 前置

- 订单 `paid`
- 库存已扣减

## 正常步骤

1. `fulfillment.create_shipment`
2. `catalog.get` 打单信息
3. `fulfillment.ship` 绑定运单
4. 回写订单 `fulfilling`

## 异常

- 部分发货：子 shipment，允许订单仍 fulfilling

## 后置

运单可跟踪；进入签收场景。
