# MODULE — catalog

## 职责

管理商品主数据：SPU/SKU、类目、属性、上下架状态、商品详情展示数据。

## 非职责

- 不持有实时库存数量（见 `inventory`）
- 不计算成交价（见 `pricing`）
- 不创建订单（见 `order`）

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| catalog.get | 按 SPU/SKU 查询可售信息 | `methods/get.md` |
| catalog.list_off_shelf | 列出待下架/已下架商品（内部） | 后续补 |
| catalog.publish | 商品上架发布 | `methods/publish.md` |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| inventory | 上架前校验可售库存策略开关（可选） |

## 状态与不变式

- 商品状态：`draft` → `on_shelf` → `off_shelf`；禁止 `draft` 直接对外可购
- 同一 SPU 下 SKU 不可重复；下架 SKU 不可进入下单链路
