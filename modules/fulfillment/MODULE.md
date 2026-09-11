# MODULE — fulfillment

## 职责

支付成功后的履约：发货单、拆包/分批发货、物流轨迹、签收完结。

## 非职责

- 不改订单应付金额
- 不决定退款（`aftersale`）
- 不维护商品资料（`catalog`，只读）

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| fulfillment.create_shipment | 创建发货单 | `methods/create_shipment.md` |
| fulfillment.ship | 确认发货 | `methods/ship.md` |
| fulfillment.sign | 签收 | `methods/sign.md` |
| fulfillment.track | 轨迹查询 | `methods/track.md` |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| order | 读已支付订单与地址 |
| catalog | 商品打单信息 |
| inventory | 可选：从预占转实扣若未在支付时扣（默认支付已扣） |

## 状态与不变式

- 仅 `paid`/`fulfilling` 订单可发
- 部分发货需子单；全量签收后订单 `completed`
- 物流单号同一发货单不可重复绑定（幂等键）
