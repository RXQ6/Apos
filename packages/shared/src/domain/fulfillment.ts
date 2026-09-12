import type { AposDb } from "../db/sqlite.js";
import { DomainError, now, requireTx } from "./errors.js";
import { emit } from "./events.js";
import { getOrder } from "./order.js";

function id(p: string): string {
  return `${p}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createShipment(
  db: AposDb,
  input: { orderId: string; lines?: Array<{ orderLineId: string; qty: number }> },
): string {
  const order = getOrder(db, input.orderId);
  if (!["paid", "fulfilling"].includes(order.status)) {
    throw new DomainError("ORDER_NOT_PAID", order.status);
  }
  return requireTx(db, () => {
    const sid = id("shp");
    db.prepare(
      `INSERT INTO shipment (id, order_id, status, created_at) VALUES (?, ?, 'created', ?)`,
    ).run(sid, input.orderId, now());
    const allLines = db
      .prepare(`SELECT id, sku_id, qty FROM order_line WHERE order_id = ?`)
      .all(input.orderId) as Array<{ id: string; sku_id: string; qty: number }>;
    const pairs = input.lines ?? allLines.map((l) => ({ orderLineId: l.id, qty: l.qty }));
    for (const p of pairs) {
      db.prepare(
        `INSERT INTO shipment_line (id, shipment_id, order_line_id, qty) VALUES (?, ?, ?, ?)`,
      ).run(id("sl"), sid, p.orderLineId, p.qty);
    }
    db.prepare(`UPDATE orders SET status = 'fulfilling', updated_at = ? WHERE id = ?`).run(
      now(),
      input.orderId,
    );
    emit("fulfillment.created", { shipmentId: sid, orderId: input.orderId });
    return sid;
  });
}

export function shipShipment(
  db: AposDb,
  input: { shipmentId: string; carrier: string; trackingNo: string },
): { status: string } {
  const row = db
    .prepare(`SELECT id, status, order_id FROM shipment WHERE id = ?`)
    .get(input.shipmentId) as
    | { id: string; status: string; order_id: string }
    | undefined;
  if (!row) throw new DomainError("SHIPMENT_NOT_FOUND", input.shipmentId);
  if (row.status === "shipped" || row.status === "signed") return { status: row.status };
  if (!input.trackingNo) throw new DomainError("TRACKING_REQUIRED", "trackingNo");
  db.prepare(
    `UPDATE shipment SET status = 'shipped', carrier = ?, tracking_no = ?, shipped_at = ?
     WHERE id = ?`,
  ).run(input.carrier, input.trackingNo, now(), input.shipmentId);
  emit("shipment.shipped", {
    shipmentId: input.shipmentId,
    orderId: row.order_id,
    trackingNo: input.trackingNo,
  });
  return { status: "shipped" };
}

export function signShipment(db: AposDb, shipmentId: string): {
  status: string;
  orderStatus: string;
} {
  return requireTx(db, () => {
    const row = db
      .prepare(`SELECT id, status, order_id FROM shipment WHERE id = ?`)
      .get(shipmentId) as
      | { id: string; status: string; order_id: string }
      | undefined;
    if (!row) throw new DomainError("SHIPMENT_NOT_FOUND", shipmentId);
    if (row.status === "created") {
      throw new DomainError("SHIPMENT_NOT_SHIPPED", shipmentId);
    }
    if (row.status !== "signed") {
      db.prepare(`UPDATE shipment SET status = 'signed', signed_at = ? WHERE id = ?`).run(
        now(),
        shipmentId,
      );
    }
    const shipped = db
      .prepare(
        `SELECT COALESCE(SUM(sl.qty),0) AS shipped_qty FROM shipment_line sl
         JOIN order_line ol ON ol.id = sl.order_line_id
         JOIN shipment s ON s.id = sl.shipment_id
         WHERE ol.order_id = ? AND s.status IN ('shipped','signed')`,
      )
      .get(row.order_id) as { shipped_qty: number };
    const ordered = db
      .prepare(`SELECT COALESCE(SUM(qty),0) AS q FROM order_line WHERE order_id = ?`)
      .get(row.order_id) as { q: number };
    const open = db
      .prepare(
        `SELECT COUNT(*) AS n FROM shipment WHERE order_id = ? AND status NOT IN ('signed')`,
      )
      .get(row.order_id) as { n: number };
    if (open.n === 0 && shipped.shipped_qty >= ordered.q) {
      db.prepare(
        `UPDATE orders SET status = 'completed', updated_at = ? WHERE id = ? AND status IN ('paid','fulfilling')`,
      ).run(now(), row.order_id);
    }
    const order = getOrder(db, row.order_id);
    emit("shipment.signed", { shipmentId, orderId: row.order_id });
    return { status: "signed", orderStatus: order.status };
  });
}

export function trackShipment(db: AposDb, shipmentId: string) {
  const row = db
    .prepare(
      `SELECT id, status, carrier, tracking_no, created_at, shipped_at, signed_at
       FROM shipment WHERE id = ?`,
    )
    .get(shipmentId) as
    | {
        id: string;
        status: string;
        carrier: string | null;
        tracking_no: string | null;
        created_at: number;
        shipped_at: number | null;
        signed_at: number | null;
      }
    | undefined;
  if (!row) throw new DomainError("SHIPMENT_NOT_FOUND", shipmentId);
  const nodes: Array<{ time: number; status: string; desc: string }> = [
    { time: row.created_at, status: "created", desc: "发货单创建" },
  ];
  if (row.shipped_at) {
    nodes.push({
      time: row.shipped_at,
      status: "shipped",
      desc: `${row.carrier ?? ""} ${row.tracking_no ?? ""}`.trim(),
    });
  }
  if (row.signed_at) {
    nodes.push({ time: row.signed_at, status: "signed", desc: "已签收" });
  }
  return {
    shipmentId: row.id,
    status: row.status,
    carrier: row.carrier,
    trackingNo: row.tracking_no,
    nodes,
  };
}

export function markReturnReceived(db: AposDb, aftersaleId: string): {
  aftersaleId: string;
  orderId: string;
} {
  db.prepare(
    `UPDATE aftersale SET status = 'return_received', updated_at = ? WHERE id = ? AND status IN ('approved','returning')`,
  ).run(now(), aftersaleId);
  const row = db
    .prepare(`SELECT order_id, status FROM aftersale WHERE id = ?`)
    .get(aftersaleId) as { order_id: string; status: string } | undefined;
  if (!row) throw new DomainError("AFTERSALE_NOT_FOUND", aftersaleId);
  emit("aftersale.return_received", { aftersaleId, orderId: row.order_id });
  return { aftersaleId, orderId: row.order_id };
}
