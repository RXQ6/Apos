# MODULE — customer

## 职责

账号与身份：注册登录会话、会员等级、收货地址簿、基础画像开关。

## 非职责

- 不计算商品售价明细（`pricing` 读会员规则）
- 不存订单
- 不存库存

## 对外方法索引

| 方法 ID | 一句话 | 文档 |
|---|---|---|
| customer.register | 注册 | `methods/register.md` |
| customer.login | 登录/会话 | `methods/login.md` |
| customer.logout | 登出吊销会话 | `methods/logout.md` |
| customer.get | 查询客户信息 | `methods/get.md` |
| customer.address_save | 保存地址 | `methods/address_save.md` |
| customer.address_list | 地址列表 | 后续补 |

## 直接依赖模块

| 模块 | 原因 |
|---|---|
| （无） | 为 order/pricing 提供只读能力 |

## 状态与不变式

- 地址须归属当前 customer_id，禁止水平越权
- 会员等级变更不得改写历史订单会员价快照
