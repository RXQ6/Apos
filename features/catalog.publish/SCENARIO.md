# SCENARIO — catalog.publish

## 前置

- SPU 存在且为 draft

## 正常步骤

1. 校验类目/属性/图
2. （可选）`inventory.get`
3. 状态 → on_shelf

## 异常

- 校验失败拒绝上架

## 后置

可被 order/pricing 读取。
