# SCENARIO — customer.register

## 前置

- 未登录

## 正常步骤

1. 提交账号凭证
2. 校验唯一与强度
3. 创建账号
4. 可选自动 `customer.login`

## 异常

- 已存在 → ACCOUNT_EXISTS
- 验证码失败（若启用）→ 拒绝
