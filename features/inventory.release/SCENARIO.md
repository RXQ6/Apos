# SCENARIO — inventory.release

## 触发

- order.cancel / order.timeout_cancel / payment.timeout_close

## 正常步骤

1. 定位 preoccupy
2. 状态 released
3. 可售增加

## 禁止

- 无单据加库存
