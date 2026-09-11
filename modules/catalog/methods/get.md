# catalog.get

## 职责

返回 SPU/SKU 的在售信息（标题、属性、基准价、状态）。

## 谁调用

- order / pricing / fulfillment

## 输入

- spu_id 或 sku_ids[]

## 输出

- 状态必须是 `on_shelf` 才可进入下单

## 禁止

- 向下单链路返回草稿/下架数据（应报错）
