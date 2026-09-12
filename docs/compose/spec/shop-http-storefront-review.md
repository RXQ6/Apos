# Review — shop-http-storefront (uncommitted apps/shop)

Scope: `apps/shop/**`, `features/shop.http_storefront/`, contracts/feature-list touchpoints.
Gate already reported PASS (shared 10/10, shop 5/5, verify 40/19) — not re-run.

## Spec compliance (parent acceptance)

| # | Acceptance | Verdict | Evidence |
|---|---|---|---|
| 1 | `createShopApp` routes health/auth/catalog/cart/order/pay/sandbox-settle/seed | **pass** | `apps/shop/src/app.ts` all 16 routes present |
| 2 | Guest cart via `X-Guest-Id`; order requires Bearer | **pass** | `ownerFrom` guest path; `requireCustomer` on `POST /api/orders` → `AUTH_FAILED` 401 |
| 3 | DomainError → `{code,message}`; `SIGN_INVALID` 400 | **pass** | `jsonError` maps `SIGN_INVALID`→400, `AUTH_FAILED`→401 |
| 4 | Static `/` serves `index.html` | **pass** | `app.get("/")` + test `景枢小店` |
| 5 | Tests: full buy / guest order 401 / bad callback / health+seed / html | **pass** | `apps/shop/tests/shop.test.ts` 5 cases |
| 6 | feature passing; contracts + feature-list updated | **pass*** | `harness.status=passing`; `feature-list` row; contracts note `apps/shop` |

\*See critical findings — passing is recorded, but written acceptance text and schema are not fully consistent with the implementation.

## Correctness

**Works as specified**
- Reuses `@apos/shared` domain (`cart*`, `createOrder`, `createPayment`, `chargePayment`, `sandboxSettle`, `receiveChannelCallback`). No inventory/payment bypass.
- Invalid Bearer on cart does **not** silently fall back to guest; `resolveCustomer` throws `AUTH_FAILED`.
- Seed is idempotent (existing SKU skipped). Full buy path decrements stock 20→18.

**Gaps**
- Guest cart lines are orphaned on login: storefront `ensureLogin()` switches owner to `user` cart; domain has `cartMerge` but it is never called from `/api/auth/login|register`.
- After order+pay, cart still holds ordered lines (`cartClearChecked` unused); a second “创建订单” can duplicate.
- `GET/PATCH` order and all payment routes have **no ownership check** (IDOR by order/payment id). Acceptable only as local demo.
- `POST /api/orders` body uses `items` / `fromCart`; contracts say `batch` or `lines`; shop spec says `lines` or checked cart.

## Consistency

| Area | Issue |
|---|---|
| `features/shop.http_storefront/SCENARIO.md` | Says “无 token 写购物车/下单 → 401”; cart write without token is **200** (guest). Conflicts with spec S2 + tests. |
| `feature.json` acceptance | “未登录/非法 token 的写接口返回 401” is **false for cart writes**; only order create matches. |
| `docs/schemas/feature.schema.json` | `domain` enum has no `shop`; feature uses `"domain": "shop"`. VERIFY L2 requires legal enums. |
| `p0-contracts.md` table | Most paths lack `/api`; only sandbox-settle/seed have it. Note line says all are `/api`. |
| `p0-contracts.md` | No `DELETE /cart/items/:id` (shop implements it). |
| `QUALITY.md` / root `tsconfig` references | No shop entry; `apps/shop` not in project references (`npm run typecheck` skips it). |
| Spec frontmatter | `commits: # filled at delivery` still placeholder. |

## Critical

1. **Acceptance text vs behavior** — `SCENARIO.md` + `feature.json` acceptance claim 401 on unauthenticated writes; guest cart is intentional 200. `passing` is only defensible after aligning those strings with guest-cart design (or changing behavior).
2. **Schema enum** — `"domain": "shop"` is illegal under `feature.schema.json`; add `shop` or reclassify domain.
3. **Guest→login cart drop** — UI invites guest cart then auto-login on order; without `cartMerge` the closed loop fails for that path.
4. **No order/payment authorization** — cancel/get/settle by id without customer match; fine on localhost only, not beyond.

## Non-critical

- Contracts path prefix / DELETE route drift vs shop implementation.
- Redundant per-route `try/catch` + `app.onError`; `c as never` type escapes.
- Seed existence check via raw SQL (domain does the write).
- Default guest id `"guest-demo"` shares one cart when header omitted.
- Malformed JSON → 500 `INTERNAL` instead of 400; NaN `page`/`pageSize`.
- Storefront HTML interpolates titles unescaped (XSS if untrusted catalog data).
- `INIT.md` still says “纯文档仓库”; `status: designed` + `harness: passing` pattern matches other features (OK).
- Error map incomplete (`PAYMENT_ALREADY_SUCCESS` → 400 not 409).

## Recommendation

Implementation matches the parent acceptance surface and is a coherent demo slice. Before treating harness `passing` as clean: fix schema domain enum, rewrite SCENARIO/feature acceptance for guest cart, wire `cartMerge` on login (or document that guest cart is throwaway), and either add ownership checks or document open payment demo endpoints as explicit non-goals.
