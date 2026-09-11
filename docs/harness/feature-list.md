# feature-list — 机器可读功能清单（单一权威来源）

调度器选下一个任务、验证器判完成、交接报告生成，都读本文件 + `features/*/feature.json`。  
**禁止**与对话记录出现冲突定义；冲突时以本清单与 json 为准。

## 状态机

`not_started | active | blocked | passing`  
转移见 `docs/harness/VERIFY.md`。WIP=1：全仓同时最多一个 `active`。

## 业务拍板（已解除阻塞）

- 库存：支付成功时 `deduct`；下单仅 `preoccupy`
- 优惠：活动价 > 会员价 > 券；默认一单一张券
- 退货退款：仓收货后才 refund + 回库
- 超卖：DB 事务原子预占

## 索引

| ID | 标题 | 优先级 | 状态 | 验证 | 场景目录 |
|---|---|---|---|---|---|
| order.create | 创建订单 | P0 | passing | docs:verify + L3 走读 | `features/order.create/` |
| agent.workbench | 场景规划工作台 | P0 | not_started | docs:verify | `features/agent.workbench/` |
| agent.provider_config | 模型通道配置 | P0 | not_started | docs:verify | `features/agent.provider_config/` |
| customer.register | 用户注册 | P0 | passing | docs:verify | `features/customer.register/` |
| customer.login | 用户登录 | P0 | passing | docs:verify | `features/customer.login/` |
| customer.logout | 退出登录 | P1 | not_started | docs:verify | `features/customer.logout/` |
| customer.address_save | 保存收货地址 | P1 | not_started | docs:verify | `features/customer.address_save/` |
| catalog.search | 商品搜索 | P0 | passing | docs:verify | `features/catalog.search/` |
| catalog.detail | 商品详情 | P0 | not_started | docs:verify | `features/catalog.detail/` |
| catalog.publish | 商品上架 | P1 | passing | docs:verify | `features/catalog.publish/` |
| catalog.off_shelf | 商品下架 | P1 | not_started | docs:verify | `features/catalog.off_shelf/` |
| cart.add | 加购 | P0 | passing | docs:verify | `features/cart.add/` |
| cart.update | 改购物车 | P0 | not_started | docs:verify | `features/cart.update/` |
| cart.checkout_ready | 结算就绪 | P0 | passing | docs:verify | `features/cart.checkout_ready/` |
| cart.merge | 登录合并购物车 | P0 | not_started | docs:verify | `features/cart.merge/` |
| inventory.preoccupy | 下单预占 | P0 | passing | docs:verify | `features/inventory.preoccupy/` |
| inventory.deduct | 支付扣减 | P0 | passing | docs:verify | `features/inventory.deduct/` |
| inventory.release | 释放预占 | P0 | passing | docs:verify | `features/inventory.release/` |
| inventory.oversell_guard | 超卖防护 | P0 | passing | docs:verify | `features/inventory.oversell_guard/` |
| pricing.quote | 结算报价 | P0 | not_started | docs:verify | `features/pricing.quote/` |
| pricing.coupon_receive | 领券 | P1 | not_started | docs:verify | `features/pricing.coupon_receive/` |
| pricing.coupon_apply | 用券 | P1 | not_started | docs:verify | `features/pricing.coupon_apply/` |
| pricing.promo_conflict | 优惠冲突 | P1 | not_started | docs:verify | `features/pricing.promo_conflict/` |
| payment.charge | 发起支付 | P0 | passing | docs:verify | `features/payment.charge/` |
| payment.fail_retry | 支付失败重试 | P0 | not_started | docs:verify | `features/payment.fail_retry/` |
| payment.callback | 支付回调 | P0 | passing | docs:verify + 场景走读 | `features/payment.callback/` |
| payment.timeout_close | 支付超时 | P0 | not_started | docs:verify | `features/payment.timeout_close/` |
| order.get | 订单详情 | P0 | not_started | docs:verify | `features/order.get/` |
| order.repay | 再次支付 | P0 | not_started | docs:verify | `features/order.repay/` |
| order.cancel | 用户取消 | P0 | passing | docs:verify | `features/order.cancel/` |
| order.timeout_cancel | 超时关单 | P0 | not_started | docs:verify | `features/order.timeout_cancel/` |
| order.address_change | 支付前改址 | P1 | not_started | docs:verify | `features/order.address_change/` |
| fulfillment.ship | 发货 | P0 | passing | docs:verify | `features/fulfillment.ship/` |
| fulfillment.sign | 签收 | P0 | passing | docs:verify | `features/fulfillment.sign/` |
| fulfillment.track | 物流轨迹 | P1 | not_started | docs:verify | `features/fulfillment.track/` |
| fulfillment.partial_ship | 部分发货 | P1 | not_started | docs:verify | `features/fulfillment.partial_ship/` |
| aftersale.approve | 售后审核 | P0 | not_started | docs:verify | `features/aftersale.approve/` |
| aftersale.refund_only | 仅退款 | P0 | passing | docs:verify | `features/aftersale.refund_only/` |
| aftersale.return_refund | 退货退款 | P0 | passing | docs:verify | `features/aftersale.return_refund/` |

## 验证命令约定

| 前缀 | 含义 |
|---|---|
| `docs:verify` | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1` |
| `scenario:walk <id>` | 按 SCENARIO.md 步骤走读 |
| `journey:walk` | 按 `docs/journey/user-journey.md` L3 剧本全链路走读 |
| `custom:...` | 场景 json `harness.verify` 覆盖 |
