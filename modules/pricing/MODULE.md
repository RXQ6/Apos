# MODULE — pricing

## 职责

计算应付价：基准价、优惠券、活动价、冲突消解、报价快照。

## 非职责

- 不改库存
- 不完成收款
- 不维护商品标题/主图（`catalog`）

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| pricing.quote | 对购物车/商品行报价 | `methods/quote.md` |
| pricing.coupon_apply | 应用优惠券 | 后续补 |
| pricing.resolve_conflict | 多优惠冲突决策 | 后续补 |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| catalog | 取在售价与类目 |
| customer | 会员价/券资格 |

## 状态与不变式

- 订单落库必须保存报价快照，禁止支付时重算漂移
- 同一订单行默认只生效一种「最优可叠加策略」，冲突规则写入 ROUTING
