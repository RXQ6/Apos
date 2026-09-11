# customer.register

## 职责

创建新买家账号。

## 谁调用

- 场景 `customer.register`

## 输入

- account（邮箱/手机号）, password, 验证码?

## 输出

- customer_id；可选 session

## 失败

- `ACCOUNT_EXISTS` / `WEAK_PASSWORD` / `CAPTCHA_INVALID`

## 禁止

- 明文存密码；日志打印密码
