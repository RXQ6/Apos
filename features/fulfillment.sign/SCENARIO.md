# SCENARIO — fulfillment.sign

## 正常步骤

1. 轨迹/用户确认签收
2. shipment → signed
3. 全量签收 → order completed

## 异常

- 拒收 → 进入 aftersale/逆向（另卡，可挂 return_refund）
