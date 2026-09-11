import type { AposDb } from "../db/sqlite.js";
import { DomainError, now } from "./errors.js";
import { getStock } from "./inventory.js";

export function publishSpu(db: AposDb, spuId: string): string {
  const spu = db.prepare(`SELECT id, status FROM spu WHERE id = ?`).get(spuId) as
    | { id: string; status: string }
    | undefined;
  if (!spu) throw new DomainError("SPU_NOT_FOUND", spuId);
  const incomplete = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sku WHERE spu_id = ? AND (title IS NULL OR title = '' OR price_cents < 0)`,
    )
    .get(spuId) as { n: number };
  if (incomplete.n > 0) {
    throw new DomainError("ATTRIBUTE_INCOMPLETE", spuId);
  }
  db.prepare(`UPDATE spu SET status = 'on_shelf', updated_at = ? WHERE id = ?`).run(
    now(),
    spuId,
  );
  db.prepare(`UPDATE sku SET status = 'on_shelf' WHERE spu_id = ?`).run(spuId);
  return "on_shelf";
}

export function offShelfSpu(db: AposDb, spuId: string): string {
  db.prepare(`UPDATE spu SET status = 'off_shelf', updated_at = ? WHERE id = ?`).run(
    now(),
    spuId,
  );
  db.prepare(`UPDATE sku SET status = 'off_shelf' WHERE spu_id = ?`).run(spuId);
  return "off_shelf";
}

export function createSpu(
  db: AposDb,
  input: { id?: string; title: string; categoryId?: string },
): string {
  const id = input.id ?? `spu_${now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO spu (id, title, category_id, status, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?)`,
  ).run(id, input.title, input.categoryId ?? "default", now(), now());
  return id;
}

export function attachSku(
  db: AposDb,
  spuId: string,
  sku: { id?: string; title: string; priceCents: number; onHand?: number },
): string {
  const id = sku.id ?? `sku_${now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO sku (id, spu_id, title, price_cents, status) VALUES (?, ?, ?, ?, 'draft')
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, price_cents=excluded.price_cents`,
  ).run(id, spuId, sku.title, sku.priceCents);
  if (sku.onHand !== undefined) {
    db.prepare(
      `INSERT INTO inventory (sku_id, on_hand, preoccupied) VALUES (?, ?, 0)
       ON CONFLICT(sku_id) DO UPDATE SET on_hand=excluded.on_hand`,
    ).run(id, sku.onHand);
  }
  return id;
}

export function catalogSearch(
  db: AposDb,
  query: { q?: string; categoryId?: string; page?: number; pageSize?: number },
): Array<{ spuId: string; title: string; status: string; priceFromCents: number }> {
  const page = Math.max(1, query.page ?? 1);
  const size = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * size;
  const like = query.q ? `%${query.q}%` : "%";
  const cat = query.categoryId;
  const rows = cat
    ? (db
        .prepare(
          `SELECT s.id, s.title, s.status,
                  (SELECT MIN(k.price_cents) FROM sku k WHERE k.spu_id = s.id AND k.status='on_shelf') AS price_from
           FROM spu s
           WHERE s.status = 'on_shelf' AND s.category_id = ? AND s.title LIKE ?
           ORDER BY s.updated_at DESC LIMIT ? OFFSET ?`,
        )
        .all(cat, like, size, offset) as Array<Record<string, unknown>>)
    : (db
        .prepare(
          `SELECT s.id, s.title, s.status,
                  (SELECT MIN(k.price_cents) FROM sku k WHERE k.spu_id = s.id AND k.status='on_shelf') AS price_from
           FROM spu s
           WHERE s.status = 'on_shelf' AND s.title LIKE ?
           ORDER BY s.updated_at DESC LIMIT ? OFFSET ?`,
        )
        .all(like, size, offset) as Array<Record<string, unknown>>);
  return rows.map((r) => ({
    spuId: String(r.id),
    title: String(r.title),
    status: String(r.status),
    priceFromCents: Number(r.price_from ?? 0),
  }));
}

export function catalogDetail(db: AposDb, spuId: string) {
  const spu = db
    .prepare(`SELECT id, title, status, category_id FROM spu WHERE id = ?`)
    .get(spuId) as
    | { id: string; title: string; status: string; category_id: string }
    | undefined;
  if (!spu) throw new DomainError("SPU_NOT_FOUND", spuId);
  const skus = db
    .prepare(
      `SELECT id, title, price_cents, status FROM sku WHERE spu_id = ?`,
    )
    .all(spuId) as Array<{
    id: string;
    title: string;
    price_cents: number;
    status: string;
  }>;
  return {
    spu: {
      id: spu.id,
      title: spu.title,
      status: spu.status,
      categoryId: spu.category_id,
    },
    skus: skus.map((k) => {
      let stockHint: ReturnType<typeof getStock> | null = null;
      try {
        if (k.status === "on_shelf") stockHint = getStock(db, k.id);
      } catch {
        stockHint = null;
      }
      return {
        id: k.id,
        title: k.title,
        priceCents: k.price_cents,
        status: k.status,
        stockHint,
      };
    }),
  };
}
