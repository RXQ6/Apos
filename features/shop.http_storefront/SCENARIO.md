# SCENARIO — shop.http_storefront

## 前置

- `apps/shop` 服务已启动（默认 `http://127.0.0.1:8787`）
- 本地 SQLite；可调用 `/api/admin/seed-demo` 写入演示商品

## 正常步骤

1. 打开 `/` 前台或直接调 API
2. `GET /api/catalog/search` 浏览商品
3. `POST /api/auth/register` 或 `login` 获得 Bearer token
4. `POST /api/cart/items` 加购 → `POST /api/cart/checkout-ready`
5. `POST /api/orders` 创建订单（pending_payment，预占库存）
6. `POST /api/payments` + `/charge` 进入 paying
7. `POST /api/payments/:id/sandbox-settle` 模拟渠道成功（验签入账）
8. `GET /api/orders/:id` 见 `paid`

## 异常

- 无 Bearer 创建订单 → 401 `AUTH_FAILED`
- 非本人订单读写 → 403 `FORBIDDEN`
- 验签失败回调 → `SIGN_INVALID`，库存不变
- 库存不足 → 4xx `STOCK_INSUFFICIENT`

游客可加购；登录合并游客车；下单成功清除已勾选购物车行。

## 后置

订单 paid；库存实扣；可继续接履约（本阶段前台不展示）。
