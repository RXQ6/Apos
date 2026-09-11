import type { AposDb } from "../db/sqlite.js";
import { DomainError, now, requireTx } from "./errors.js";
import { ensureOnShelf, getStock } from "./inventory.js";

export interface CartLine {
  id: string;
  skuId: string;
  qty: number;
  checked: boolean;
  state: "active" | "invalid";
}

export interface Cart {
  id: string;
  ownerType: "user" | "guest";
  ownerId: string;
  lines: CartLine[];
}

function id(p: string): string {
  return `${p}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getOrCreateCart(
  db: AposDb,
  ownerType: "user" | "guest",
  ownerId: string,
): Cart {
  const row = db
    .prepare(`SELECT id FROM cart WHERE owner_type = ? AND owner_id = ?`)
    .get(ownerType, ownerId) as { id: string } | undefined;
  if (row) return loadCart(db, row.id);
  const cartId = id("cart");
  db.prepare(
    `INSERT INTO cart (id, owner_type, owner_id, created_at) VALUES (?, ?, ?, ?)`,
  ).run(cartId, ownerType, ownerId, now());
  return loadCart(db, cartId);
}

export function loadCart(db: AposDb, cartId: string): Cart {
  const head = db
    .prepare(`SELECT id, owner_type, owner_id FROM cart WHERE id = ?`)
    .get(cartId) as
    | { id: string; owner_type: "user" | "guest"; owner_id: string }
    | undefined;
  if (!head) throw new DomainError("CART_NOT_FOUND", cartId);
  const rows = db
    .prepare(
      `SELECT id, sku_id, qty, checked, state FROM cart_line WHERE cart_id = ?`,
    )
    .all(cartId) as Array<{
    id: string;
    sku_id: string;
    qty: number;
    checked: number;
    state: CartLine["state"];
  }>;
  return {
    id: head.id,
    ownerType: head.owner_type,
    ownerId: head.owner_id,
    lines: rows.map((r) => ({
      id: r.id,
      skuId: r.sku_id,
      qty: r.qty,
      checked: !!r.checked,
      state: r.state,
    })),
  };
}

export function cartAdd(
  db: AposDb,
  cartId: string,
  skuId: string,
  qty: number,
): Cart {
  if (qty <= 0) throw new DomainError("QTY_INVALID", "qty must > 0");
  ensureOnShelf(db, skuId);
  return requireTx(db, () => {
    const existing = db
      .prepare(
        `SELECT id, qty FROM cart_line WHERE cart_id = ? AND sku_id = ? AND state = 'active'`,
      )
      .get(cartId, skuId) as { id: string; qty: number } | undefined;
    if (existing) {
      db.prepare(`UPDATE cart_line SET qty = ? WHERE id = ?`).run(
        existing.qty + qty,
        existing.id,
      );
    } else {
      db.prepare(
        `INSERT INTO cart_line (id, cart_id, sku_id, qty, checked, state)
         VALUES (?, ?, ?, ?, 1, 'active')`,
      ).run(id("cl"), cartId, skuId, qty);
    }
    return loadCart(db, cartId);
  });
}

export function cartUpdate(
  db: AposDb,
  cartId: string,
  lineId: string,
  patch: { qty?: number; checked?: boolean; remove?: boolean },
): Cart {
  return requireTx(db, () => {
    if (patch.remove) {
      db.prepare(`DELETE FROM cart_line WHERE id = ? AND cart_id = ?`).run(
        lineId,
        cartId,
      );
      return loadCart(db, cartId);
    }
    const line = db
      .prepare(`SELECT qty, checked FROM cart_line WHERE id = ? AND cart_id = ?`)
      .get(lineId, cartId) as { qty: number; checked: number } | undefined;
    if (!line) throw new DomainError("LINE_NOT_FOUND", lineId);
    if (patch.qty !== undefined) {
      if (patch.qty <= 0) {
        db.prepare(`DELETE FROM cart_line WHERE id = ?`).run(lineId);
      } else {
        db.prepare(`UPDATE cart_line SET qty = ? WHERE id = ?`).run(patch.qty, lineId);
      }
    }
    if (patch.checked !== undefined) {
      db.prepare(`UPDATE cart_line SET checked = ? WHERE id = ?`).run(
        patch.checked ? 1 : 0,
        lineId,
      );
    }
    return loadCart(db, cartId);
  });
}

export function cartCheckoutReady(
  db: AposDb,
  cartId: string,
): {
  checkoutBatchId: string;
  items: Array<{ skuId: string; qty: number; priceCents: number }>;
  payAmountCents: number;
} {
  const cart = loadCart(db, cartId);
  const items: Array<{ skuId: string; qty: number; priceCents: number }> = [];
  for (const line of cart.lines) {
    if (!line.checked || line.state !== "active") continue;
    const sku = ensureOnShelf(db, line.skuId);
    const stock = getStock(db, line.skuId);
    if (stock.available < line.qty) {
      throw new DomainError("LINE_INVALID", `stock low for ${line.skuId}`);
    }
    items.push({
      skuId: line.skuId,
      qty: line.qty,
      priceCents: sku.priceCents,
    });
  }
  if (items.length === 0) throw new DomainError("CART_EMPTY", "no checked lines");
  const payAmountCents = items.reduce((s, i) => s + i.priceCents * i.qty, 0);
  return { checkoutBatchId: id("batch"), items, payAmountCents };
}

export function cartClearChecked(db: AposDb, cartId: string, skuIds: string[]): void {
  if (skuIds.length === 0) return;
  for (const skuId of skuIds) {
    db.prepare(
      `DELETE FROM cart_line WHERE cart_id = ? AND sku_id = ? AND checked = 1`,
    ).run(cartId, skuId);
  }
}

/** Login merge: move guest lines into user cart (sum qty). */
export function cartMerge(db: AposDb, guestOwnerId: string, userId: string): Cart {
  return requireTx(db, () => {
    const guest = getOrCreateCart(db, "guest", guestOwnerId);
    const user = getOrCreateCart(db, "user", userId);
    for (const line of guest.lines) {
      cartAdd(db, user.id, line.skuId, line.qty);
    }
    db.prepare(`DELETE FROM cart_line WHERE cart_id = ?`).run(guest.id);
    return loadCart(db, user.id);
  });
}
