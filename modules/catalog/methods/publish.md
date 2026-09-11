# catalog.publish

## 职责

商品发布上架：校验类目、属性完整、（可选）库存策略。

## 谁调用

- 运营后台；场景 `catalog.publish`

## 输入

- spu_id

## 输出

- status=`on_shelf`

## 依赖

- `inventory.get`（可选）

## 禁止

- 缺关键属性上架
