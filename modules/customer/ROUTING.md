# ROUTING — customer

| 从 | 到 | 触发 | 允许方式 | 禁止 |
|---|---|---|---|---|
| `customer.login` | 会话签发 | 登录成功 | 标准会话 | 明文存密码 |
| `order.create` | `customer.get` / `customer.address_list` | 下单 | 只读带鉴权 | 用他人地址 |
| `pricing.quote` | `customer.get` | 会员等级 | 只读 | — |
| `aftersale.open` | `customer.get` | 身份校验 | 只读 | — |

## 对称性

order / pricing / aftersale 对称。
