# pricing.coupon_apply

## 职责

结算时应用一张券并写入报价明细。

## 输入

- quote 上下文, coupon_id, customer_id

## 规则

- 门槛/适用类目/过期
- 默认一单一张；与活动价冲突见 resolve_conflict

## 禁止

- 支付阶段改券
