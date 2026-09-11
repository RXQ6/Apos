# SCENARIO — pricing.quote

## 前置

- 用户已登录；SKU 在售

## 正常步骤

1. 拉取基准价
2. 套用会员/券/活动
3. 产出明细与 pay_amount、snapshot_id

## 后置

供 `order.create` 使用；支付不得重算。
