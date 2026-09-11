# SCENARIO — cart.merge

## 正常步骤

1. 登录成功
2. 读取 guest cart
3. 合并到 user cart（幂等）
4. 清空 guest 标记

## 后置

- 用户只看到合并后购物车
