# 用户旅程总图 — 电商闭环

> 场景规划用总图。细卡在 `features/<id>/`；模块边界在 `modules/`。

## 角色

| 角色 | 说明 |
|---|---|
| buyer | 买家 |
| system | 调度/风控/超时 |
| admin | 运营/客服/仓配（简化合并，后续可拆） |

## 主旅程（Happy Path）

```text
[发现]            [决策]           [交易]              [履约]           [闭环]
catalog.search → catalog.detail → cart.add         → order.create   → payment.charge
catalog.browse     pricing.quote    cart.update        inventory.preoccupy  payment.callback
customer.register  coupon_apply     cart.checkout_ready  pricing快照落库     order.mark_paid
customer.login                    customer.address_*                      fulfillment.ship
                                                                                   ↓
                                                              fulfillment.sign → 订单完成
                                                                                   ↓
                                                    （可选）评价 / 再购 / aftersale.*
```

## 分支旅程

| 分支 | 入口 | 出口 | 关键场景 |
|---|---|---|---|
| 未支付放弃 | order.create | 可售恢复 | order.timeout_cancel, payment.timeout_close, inventory.release |
| 用户取消 | pending_payment | closed | order.cancel, inventory.release |
| 支付失败 | payment.charge | 可重试 | payment.fail_retry |
| 改址 | pending_payment | 同单 | order.address_change |
| 仅退款 | paid（未发货/符合规则） | refunded | aftersale.open → refund_only |
| 退货退款 | shipped/completed | stock_in + refunded | aftersale.return_refund（寄回→收货→回库→退款） |
| 部分发货 | paid | 多包裹 | fulfillment.partial_ship |

## 状态机（订单）

```text
created → pending_payment → paid → fulfilling → completed
              ↓                  ↓
           cancelled/closed   aftersale_* → completed/refunded
```

## 端到端验收（L3 走读剧本）

按顺序读场景卡并核对 ROUTING：

1. `customer.register` / `customer.login`
2. `customer.address_save`
3. `catalog.publish` → `catalog.search` / `catalog.detail`
4. `cart.add` → `cart.checkout_ready`
5. `pricing.quote` → `order.create` → `inventory.preoccupy`
6. `payment.charge` → `payment.callback` → `order.mark_paid` → `inventory.deduct`
7. `fulfillment.create_shipment` → `fulfillment.ship` → `fulfillment.sign`
8. 异常：`order.timeout_cancel`；售后：`aftersale.refund_only` 或 `aftersale.return_refund`

任一环缺卡或路由不对称 = 闭环未完成。
