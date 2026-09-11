# MODULE — inventory

## 职责

库存数量与占用：查询、预占、扣减、回滚释放；超卖防护。

## 非职责

- 不决定售价
- 不创建支付单
- 不直接发货

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| inventory.get | 查询可售/占用数量 | `methods/get.md` |
| inventory.preoccupy | 下单预占库存 | `methods/preoccupy.md` |
| inventory.deduct | 支付成功扣减 | `methods/deduct.md` |
| inventory.release | 取消/超时释放预占 | `methods/release.md` |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| （无强依赖） | 由 order/payment/aftersale 作为调用方 |

## 状态与不变式

- 可售 = 总仓量 − 预占 − 锁定；预占超时自动释放（默认 15 分钟，可配置）
- 同一 SKU 并发预占必须串行化或等价原子操作，禁止超卖
- `preoccupy` 与 `release` 必须幂等（按预占单号）
