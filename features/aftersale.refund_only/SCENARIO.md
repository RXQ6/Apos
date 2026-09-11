# SCENARIO — aftersale.refund_only

## 前置

- 订单已支付且在售后窗口内
- 无进行中互斥售后

## 正常步骤

1. `aftersale.open`
2. 审核 `aftersale.approve`
3. `payment.refund`
4. 售后 `closed`

## 异常

- 超额 → 拒绝
- 退款渠道失败 → `refunding` 重试/人工

## 后置

不触发库存回补（未发货）；若已发货仅退款需额外规则（Out of Scope 另卡）。
