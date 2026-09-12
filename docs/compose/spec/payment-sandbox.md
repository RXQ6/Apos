---
feature: payment-sandbox
status: delivered
updated: 2026-09-11
branch: feat/ecommerce-scenario-routing
commits: 023f8cd..3d89d48
---

# 支付沙箱（替换 mock payment.callback）

## Report

**What was built** — 用进程内 `sandbox` 渠道替换 mock 支付回调：`chargePayment` 返回 `sandbox://pay/...`；`sandboxSettle` 生成 `channelTxId` 并 HMAC-SHA256 签名；商户唯一入账口 `receiveChannelCallback` 先验签再驱动 `paymentCallbackSuccess`（幂等扣库存）。工具新增 `payment_sandbox_settle`，`payment_callback` 改为要求 `payload+signature`。

**Verification** — `npm.cmd run gate` PASS（verify 39/18、build、smoke sandbox-pay、vitest 10/10）。独立评审：7/7 验收满足，无 critical。

**Journey log**
- 先改 SCENARIO/callback/contracts 再实现，避免口头旁路
- 进程内沙箱即可闭环「验签通过才处理」；HTTP 服务留给选项 B
- FAILED 不写 `payment_tx`，SUCCESS 可覆盖 failed——留给 `payment.fail_retry` 状态机
- `paymentCallbackSuccess` 仍导出，结构上未强制 sole-entry；工具面已只走验签入口

## [S1] Problem

当前 `payment.charge` 返回 `mock://pay/...`，`payment_callback` 工具与 domain 测试直接调用 `paymentCallbackSuccess`，**跳过验签**。  
`features/payment.callback` 验收明确要求「验签通过才处理」，契约也写了 `SIGN_INVALID`，实现未闭环。

## [S2] Design

用**进程内沙箱渠道**（channel=`sandbox`）模拟真实支付渠道的异步通知链路，不引入外部 HTTP 服务（HTTP 属选项 B）。

### 签名方案

- 算法：HMAC-SHA256，hex 输出
- 密钥：`app_settings` 键 `payment.sandbox.secret`；缺省 `apos-sandbox-dev-secret`；可用 env `APOS_SANDBOX_SECRET` 覆盖
- 规范串：按固定字段顺序拼 `key=value` 行，再 `\n` 连接：

```text
amountCents=<int>
channel=sandbox
channelTxId=<string>
paymentId=<string>
status=SUCCESS|FAILED
timestamp=<ms>
```

### 对外入口

| 函数 | 职责 |
|---|---|
| `chargePayment` | channel=`sandbox` 时返回 `sandboxPayUrl` + 待签 intent，不再返回 `mock://` |
| `sandboxSettle` | **渠道侧**：生成 `channelTxId`，签名后投递回调（成功/失败） |
| `receiveChannelCallback` | **商户侧唯一入账口**：验签 → `paymentCallbackSuccess` |
| `paymentCallbackSuccess` | 保持内部入账（幂等 `channel_tx_id` → mark_paid → deduct） |

### 错误

- `SIGN_INVALID`：签名缺失/不匹配 → 拒绝，不改库存
- `UNKNOWN_PAYMENT` / `AMOUNT_MISMATCH`：沿用

### 工具面

- `payment_sandbox_settle`：模拟渠道完成支付（推荐路径）
- `payment_callback`：要求 payload+signature，走 `receiveChannelCallback`

### 交付状态说明

- FAILED 回调不写 `payment_tx`；合法 SUCCESS 可覆盖 failed（供 fail_retry）
- `paymentCallbackSuccess` 仍为公开导出，约定仅验签后调用

## [S3] Out of Scope

- 真实支付宝/微信渠道与公网回调
- Hono HTTP 服务与购物前台（选项 B）
- 渠道证书轮换、异步重试退避策略

## Tasks

- [x] T1: 更新 SCENARIO/callback.md/contracts 签名与入口 — acceptance: 文档写明 HMAC 规范串与 `receiveChannelCallback` 唯一入账口 (covers: S2)
- [x] T2: 实现 sandbox sign/verify/settle + charge 改造 — acceptance: `chargePayment('sandbox')` 不再返回 mock://；错误码含 SIGN_INVALID (covers: S2; depends: T1)
- [x] T3: 工具与测试：settle 成功/验签失败/幂等 — acceptance: vitest 覆盖三路径且 5+ 新用例通过 (covers: S2; depends: T2)
- [x] T4: gate + PROGRESS + commit — acceptance: `npm.cmd run verify && npm.cmd test -w @apos/shared` PASS，PROGRESS 更新 (covers: S2; depends: T3)
