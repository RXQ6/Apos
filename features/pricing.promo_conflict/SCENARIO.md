# SCENARIO — pricing.promo_conflict

> 拍板优先级：**活动价 > 会员价 > 券**；默认一单一张券。

## 正常步骤

1. 收集候选优惠
2. 按优先级与 stackable 过滤
3. 产出明细；不可用券给出 reason

## 禁止

- 静默丢弃且无 reason
