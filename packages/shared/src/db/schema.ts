/** Embedded so Electron bundles always have schema without fs path issues. */
export const APOS_SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  permission_mode TEXT NOT NULL DEFAULT 'ask',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_session ON session_messages(session_id, id);

CREATE TABLE IF NOT EXISTS feature_state (
  feature_id TEXT PRIMARY KEY,
  harness_status TEXT NOT NULL,
  verify_cmd TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  member_level TEXT NOT NULL DEFAULT 'base',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_session (
  token TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS address (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  receiver TEXT NOT NULL,
  phone TEXT,
  detail TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spu (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sku (
  id TEXT PRIMARY KEY,
  spu_id TEXT,
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'on_shelf'
);

CREATE TABLE IF NOT EXISTS inventory (
  sku_id TEXT PRIMARY KEY,
  on_hand INTEGER NOT NULL CHECK (on_hand >= 0),
  preoccupied INTEGER NOT NULL DEFAULT 0 CHECK (preoccupied >= 0),
  CHECK (on_hand >= preoccupied)
);

CREATE TABLE IF NOT EXISTS cart (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cart_owner ON cart(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS cart_line (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  checked INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS preoccupy (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  status TEXT NOT NULL DEFAULT 'active',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  pay_amount_cents INTEGER NOT NULL,
  price_snapshot_json TEXT NOT NULL,
  address_json TEXT,
  expire_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_line (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_tx (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  channel_tx_id TEXT NOT NULL UNIQUE,
  raw_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS refund (
  id TEXT PRIMARY KEY,
  aftersale_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  channel_refund_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shipment (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  carrier TEXT,
  tracking_no TEXT,
  created_at INTEGER NOT NULL,
  shipped_at INTEGER,
  signed_at INTEGER
);

CREATE TABLE IF NOT EXISTS shipment_line (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  order_line_id TEXT NOT NULL,
  qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS aftersale (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_line_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sku_activity (
  sku_id TEXT PRIMARY KEY,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_template (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  discount_cents INTEGER NOT NULL CHECK (discount_cents >= 0),
  min_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_stock INTEGER NOT NULL DEFAULT 0,
  received_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_instance (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused',
  order_id TEXT,
  received_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_coupon_inst_customer ON coupon_instance(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_preoccupy_order ON preoccupy(order_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_order_line_order ON order_line(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_order ON payment(order_id, status);
CREATE INDEX IF NOT EXISTS idx_shipment_order ON shipment(order_id);
CREATE INDEX IF NOT EXISTS idx_aftersale_order ON aftersale(order_id);
`;
