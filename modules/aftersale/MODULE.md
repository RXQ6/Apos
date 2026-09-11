# MODULE — aftersale

## 职责

售后单：仅退款、退货退款、审核、退款发起、完结；与订单/履约对账。

## 非职责

- 不直接拉起支付渠道原语（调用 `payment.refund`）
- 不创建正向订单
- 不维护会员等级

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| aftersale.open | 创建售后单 | `methods/open.md` |
| aftersale.approve | 审核通过 | 后续补 |
| aftersale.refund_only | 仅退款完结 | `methods/refund_only.md` |
| aftersale.return_refund | 退货退款 | 后续补 |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| order | 校验可售后状态与金额 |
| payment | 发起退款 |
| inventory | 退货后回库 |
| fulfillment | 退货收货节点 |

## 状态与不变式

- 售后单：`opened` → `approved` / `rejected` → `refunding` → `closed`
- 同一订单行并发售后需互斥规则
- 退款金额不得超过实付（分摊规则写入方法 MD）
