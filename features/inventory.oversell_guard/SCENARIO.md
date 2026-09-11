# SCENARIO — inventory.oversell_guard

> 拍板：**DB 事务/行锁原子预占**；不引入分布式锁服务。

## 规则

1. 同 SKU 预占在事务内 `UPDATE ... WHERE available >= qty`
2. 影响行数为 0 → STOCK_INSUFFICIENT
3. 全有或全无

## 验收

- 并发压测下无负库存、无幽灵预占
