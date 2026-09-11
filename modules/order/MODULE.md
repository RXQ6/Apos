# MODULE — order

## 职责

购物车结算入口、订单创建与状态机、超时关单、改址等订单生命周期。

## 非职责

- 不持有库存数字（调用 `inventory`）
- 不对接支付渠道（调用 `payment`）
- 不安排物流轨迹（`fulfillment`）

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| order.create | 创建订单 | `methods/create.md` |
| order.mark_paid | 标记已支付 | `methods/mark_paid.md` |
| order.timeout_cancel | 超时关单 | `methods/timeout_cancel.md` |
| order.cancel | 用户取消 | `methods/cancel.md` |
| order.get | 查询订单 | `methods/get.md` |
| order.change_address | 支付前改地址 | `methods/change_address.md` |
| order.repay | 再次支付 | 见场景 `order.repay` → payment.charge |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| cart | checkout_ready 结算批次 |
| catalog | 校验在售 |
| inventory | 预占/释放 |
| pricing | 报价快照 |
| customer | 地址与身份 |
| payment | 发起支付（创建后） |
| fulfillment | 支付后履约指令 |

## 状态与不变式

- 状态机：`created` → `pending_payment` → `paid` → `fulfilling` → `completed`；异常：`cancelled`, `closed`
- 未支付超时必须关单并释放预占
- 订单金额以创建时快照为准
