# SCENARIO — cart.update

## 正常步骤

1. 定位行
2. 更新 qty / checked 或删除
3. `cart.list` 回读

## 禁止

- 改他人购物车；qty<=0 应走删除
