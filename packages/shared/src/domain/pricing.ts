import type { AposDb } from "../db/sqlite.js";
import { DomainError, now, requireTx } from "./errors.js";

/** base=0, silver=5%, gold=10%, vip=15% */
const MEMBER_DISCOUNT_BPS: Record<string, number> = {
  base: 0,
  silver: 500,
  gold: 1000,
  vip: 1500,
};

export interface QuoteLine {
  skuId: string;
  qty: number;
  unitPriceCents: number;
  listPriceCents: number;
  title: string;
  source: "activity" | "member" | "list";
}

export interface QuoteResult {
  lines: QuoteLine[];
  listAmountCents: number;
  memberDiscountCents: number;
  couponDiscountCents: number;
  activitySavedCents: number;
  payAmountCents: number;
  couponInstanceId?: string;
  snapshot: {
    currency: "CNY";
    rule: "activity>member>coupon";
    memberLevel: string;
    capturedAt: number;
  };
}

export function setSkuActivityPrice(
  db: AposDb,
  skuId: string,
  priceCents: number,
): void {
  if (priceCents < 0) throw new DomainError("BAD_ARGS", "activity price");
  db.prepare(
    `INSERT INTO sku_activity (sku_id, price_cents, created_at) VALUES (?, ?, ?)
     ON CONFLICT(sku_id) DO UPDATE SET price_cents = excluded.price_cents`,
  ).run(skuId, priceCents, now());
}

export function createCouponTemplate(
  db: AposDb,
  input: {
    code: string;
    title: string;
    discountCents: number;
    minAmountCents?: number;
    totalStock?: number;
    perUserLimit?: number;
  },
): { templateId: string; code: string } {
  if (!input.code || input.discountCents <= 0) {
    throw new DomainError("BAD_ARGS", "code/discount required");
  }
  const id = `ct_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO coupon_template
      (id, code, title, discount_cents, min_amount_cents, total_stock, received_count, per_user_limit, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'active', ?)`,
  ).run(
    id,
    input.code,
    input.title || input.code,
    input.discountCents,
    input.minAmountCents ?? 0,
    input.totalStock ?? 100,
    input.perUserLimit ?? 1,
    now(),
  );
  return { templateId: id, code: input.code };
}

export function receiveCoupon(
  db: AposDb,
  input: { customerId: string; code?: string; templateId?: string },
): { couponInstanceId: string; status: string } {
  return requireTx(db, () => {
    const tpl = input.templateId
      ? (db
          .prepare(
            `SELECT id, status, total_stock, received_count, per_user_limit FROM coupon_template WHERE id = ?`,
          )
          .get(input.templateId) as
          | {
              id: string;
              status: string;
              total_stock: number;
              received_count: number;
              per_user_limit: number;
            }
          | undefined)
      : (db
          .prepare(
            `SELECT id, status, total_stock, received_count, per_user_limit FROM coupon_template WHERE code = ?`,
          )
          .get(input.code ?? "") as
          | {
              id: string;
              status: string;
              total_stock: number;
              received_count: number;
              per_user_limit: number;
            }
          | undefined);
    if (!tpl) throw new DomainError("COUPON_NOT_FOUND", input.code ?? input.templateId ?? "");
    if (tpl.status !== "active") throw new DomainError("COUPON_INACTIVE", tpl.id);
    if (tpl.received_count >= tpl.total_stock) {
      throw new DomainError("COUPON_SOLD_OUT", tpl.id);
    }
    const owned = db
      .prepare(
        `SELECT COUNT(*) AS n FROM coupon_instance WHERE customer_id = ? AND template_id = ?`,
      )
      .get(input.customerId, tpl.id) as { n: number };
    if (owned.n >= tpl.per_user_limit) {
      throw new DomainError("COUPON_LIMIT_REACHED", tpl.id);
    }
    const id = `cp_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      `INSERT INTO coupon_instance (id, template_id, customer_id, status, received_at)
       VALUES (?, ?, ?, 'unused', ?)`,
    ).run(id, tpl.id, input.customerId, now());
    db.prepare(
      `UPDATE coupon_template SET received_count = received_count + 1 WHERE id = ?`,
    ).run(tpl.id);
    return { couponInstanceId: id, status: "unused" };
  });
}

function memberDiscount(amount: number, memberLevel: string): number {
  const bps = MEMBER_DISCOUNT_BPS[memberLevel] ?? 0;
  return Math.floor((amount * bps) / 10000);
}

/**
 * activity price > member discount > coupon.
 * Coupon applies to amount after activity+member, not below 0.
 */
export function quoteCheckout(
  db: AposDb,
  input: {
    items: Array<{ skuId: string; qty: number; title?: string; listPriceCents?: number }>;
    memberLevel?: string;
    couponInstanceId?: string;
  },
): QuoteResult {
  if (!input.items.length) throw new DomainError("CART_EMPTY", "no items");
  const lines: QuoteLine[] = [];
  let listAmount = 0;
  let afterActivity = 0;
  for (const item of input.items) {
    if (item.qty <= 0) throw new DomainError("QTY_INVALID", "qty must > 0");
    let title = item.title ?? "";
    let list = item.listPriceCents;
    if (list === undefined) {
      const sku = db
        .prepare(`SELECT id, title, price_cents, status FROM sku WHERE id = ?`)
        .get(item.skuId) as
        | { id: string; title: string; price_cents: number; status: string }
        | undefined;
      if (!sku) throw new DomainError("SKU_NOT_FOUND", item.skuId);
      if (sku.status !== "on_shelf") {
        throw new DomainError("SKU_OFF_SHELF", item.skuId);
      }
      title = sku.title;
      list = sku.price_cents;
    }
    const act = db
      .prepare(`SELECT price_cents FROM sku_activity WHERE sku_id = ?`)
      .get(item.skuId) as { price_cents: number } | undefined;
    const unit = act ? act.price_cents : list;
    const source: QuoteLine["source"] = act ? "activity" : "list";
    lines.push({
      skuId: item.skuId,
      qty: item.qty,
      unitPriceCents: unit,
      listPriceCents: list,
      title,
      source,
    });
    listAmount += list * item.qty;
    afterActivity += unit * item.qty;
  }

  const level = input.memberLevel ?? "base";
  const memberDisc = memberDiscount(afterActivity, level);
  let couponDisc = 0;
  if (input.couponInstanceId) {
    const cp = db
      .prepare(
        `SELECT ci.id, ci.status, ct.discount_cents, ct.min_amount_cents
         FROM coupon_instance ci JOIN coupon_template ct ON ct.id = ci.template_id
         WHERE ci.id = ?`,
      )
      .get(input.couponInstanceId) as
      | {
          id: string;
          status: string;
          discount_cents: number;
          min_amount_cents: number;
        }
      | undefined;
    if (!cp || cp.status !== "unused") {
      throw new DomainError("COUPON_INVALID", input.couponInstanceId);
    }
    const base = afterActivity - memberDisc;
    if (base < cp.min_amount_cents) {
      throw new DomainError("COUPON_MIN_NOT_MET", String(cp.min_amount_cents));
    }
    couponDisc = Math.min(cp.discount_cents, base);
  }

  const pay = Math.max(0, afterActivity - memberDisc - couponDisc);
  return {
    lines,
    listAmountCents: listAmount,
    memberDiscountCents: memberDisc,
    couponDiscountCents: couponDisc,
    activitySavedCents: listAmount - afterActivity,
    payAmountCents: pay,
    couponInstanceId: input.couponInstanceId,
    snapshot: {
      currency: "CNY",
      rule: "activity>member>coupon",
      memberLevel: level,
      capturedAt: now(),
    },
  };
}

export function markCouponUsed(
  db: AposDb,
  couponInstanceId: string,
  orderId: string,
): void {
  db.prepare(
    `UPDATE coupon_instance SET status = 'used', order_id = ?, used_at = ?
     WHERE id = ? AND status = 'unused'`,
  ).run(orderId, now(), couponInstanceId);
}
