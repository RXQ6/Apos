# contracts — P0 API / 表 / 事件草案（实现前契约）

> 非最终 OpenAPI；给 Electron/Pi 工具与后续编码用。权威业务语义仍以 `features/` + `modules/` 为准。

## 约定

- 鉴权：`Authorization: Bearer <session>`
- 幂等：写接口支持 `Idempotency-Key` 或业务幂等键
- 错误：`{ "code": string, "message": string }`
- 金额：整数分

---

## HTTP/RPC 草案（核心）

| Method | Path | 场景 | 说明 |
|---|---|---|---|
| POST | `/auth/register` | customer.register | |
| POST | `/auth/login` | customer.login | |
| GET | `/me/addresses` | customer.address_list | |
| POST | `/me/addresses` | customer.address_save | |
| GET | `/catalog/search` | catalog.search | |
| GET | `/catalog/spus/:id` | catalog.detail | |
| GET | `/cart` | cart.list | |
| POST | `/cart/items` | cart.add | |
| PATCH | `/cart/items/:id` | cart.update | |
| POST | `/cart/checkout-ready` | cart.checkout_ready | → checkout_batch_id |
| POST | `/orders` | order.create | body 带 batch 或 lines |
| GET | `/orders/:id` | order.get | |
| POST | `/orders/:id/cancel` | order.cancel | |
| POST | `/orders/:id/address` | order.address_change | |
| POST | `/payments` | payment.create | |
| POST | `/payments/:id/charge` | payment.charge | |
| POST | `/payments/callback` | payment.callback | 渠道回调，需验签 |
| POST | `/aftersales` | aftersale.open | |
| POST | `/aftersales/:id/refund-only` | aftersale.refund_only | |
| POST | `/aftersales/:id/return-refund` | aftersale.return_refund | 状态机推进 |
| GET | `/fulfillments/:order_id` | fulfillment.* | |
| POST | `/internal/fulfillments/:id/ship` | fulfillment.ship | |
| POST | `/internal/fulfillments/:id/sign` | fulfillment.sign | |
| POST | `/internal/aftersales/:id/return-received` | 收货事件 | 触发回库+退款 |

---

## SQLite 表草案（`~/.apos/data.db`）

```sql
-- 用户
customer(id TEXT PK, account TEXT UNIQUE, password_hash TEXT, member_level TEXT, created_at);

address(id TEXT PK, customer_id, receiver, phone, detail, is_default INT, created_at);

-- 商品
spu(id TEXT PK, title, category_id, status, created_at); -- draft|on_shelf|off_shelf
sku(id TEXT PK, spu_id, attrs_json, price_cents, status);

-- 库存
inventory(sku_id TEXT PK, on_hand INT, preoccupied INT, CHECK (on_hand >= preoccupied AND preoccupied >= 0));
preoccupy(id TEXT PK, order_id, sku_id, qty, expires_at, status); -- active|released|deducted

-- 购物车
cart(id TEXT PK, owner_type, owner_id); -- user|guest
cart_line(id TEXT PK, cart_id, sku_id, qty, checked INT, state);

-- 订单
orders(id TEXT PK, customer_id, status, pay_amount_cents, address_json, price_snapshot_json, checkout_batch_id, expire_at, created_at);
order_line(id TEXT PK, order_id, sku_id, qty, price_cents, title);

-- 支付
payment(id TEXT PK, order_id, amount_cents, channel, status, created_at);
payment_tx(id TEXT PK, payment_id, channel_tx_id UNIQUE, raw_json, created_at);

-- 履约
shipment(id TEXT PK, order_id, status, carrier, tracking_no, created_at);
shipment_line(id TEXT PK, shipment_id, order_line_id, qty);

-- 售后
aftersale(id TEXT PK, order_id, order_line_id, type, status, amount_cents, created_at); -- refund_only|return_refund
refund(id TEXT PK, aftersale_id, payment_id, amount_cents, status, channel_refund_id);

-- 会话镜像（业务 harness）
feature_state(feature_id TEXT PK, harness_status, verify_cmd, updated_at);
```

索引建议：`orders(customer_id,status)`、`payment_tx(channel_tx_id)`、`preoccupy(order_id,status)`、`cart_line(cart_id)`。

---

## 事件草案（进程内总线 → 可后续外置）

| 事件 | 载荷要点 | 订阅方 |
|---|---|---|
| `order.created` | order_id | payment, 调度（超时） |
| `payment.succeeded` | payment_id, channel_tx_id | order.mark_paid → inventory.deduct → fulfillment |
| `payment.failed` | payment_id | UI/重试 |
| `order.cancelled` | order_id, reason | inventory.release |
| `order.paid` | order_id | fulfillment.create_shipment |
| `shipment.shipped` | shipment_id | 通知 |
| `shipment.signed` | shipment_id | order 完结判断 |
| `aftersale.return_received` | aftersale_id | inventory 回补 → payment.refund |
| `payment.refunded` | refund_id | aftersale closed |

### 关键不变式

1. 下单：catalog 校验 → pricing 快照 → inventory.preoccupy → 落库（失败全回滚）  
2. 支付成功：幂等 `channel_tx_id` → mark_paid → deduct  
3. 退货退款：return_received 之前 **禁止** refund  

---

## 与文档域映射

- 场景验收仍看 `features/*/feature.json` `acceptance`  
- 方法契约看 `modules/*/methods/*.md`  
- 本文件增补「接口/表/事件」实现面，冲突时 **先改场景语义再改本文件**
