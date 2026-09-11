# customer.login

## 职责

认证并签发会话。

## 谁调用

- 登录场景 `customer.login`

## 输入

- credential（账号+密码/验证码等）

## 输出

- session_token / customer_id

## 禁止

- 明文存储密码；会话无限期无吊销
