-- Apos local DB (~/.apos/data.db) — session mirror + feature_state
-- Document domain (features/, modules/) remains authoritative.

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
  ts INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

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

CREATE INDEX IF NOT EXISTS idx_msg_session ON session_messages(session_id, id);

-- ===== Ecommerce runtime (minimal vertical slice) =====

CREATE TABLE IF NOT EXISTS sku (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'on_shelf'
    CHECK (status IN ('draft', 'on_shelf', 'off_shelf'))
);

CREATE TABLE IF NOT EXISTS inventory (
  sku_id TEXT PRIMARY KEY REFERENCES sku(id),
  on_hand INTEGER NOT NULL CHECK (on_hand >= 0),
  preoccupied INTEGER NOT NULL DEFAULT 0 CHECK (preoccupied >= 0),
  CHECK (on_hand >= preoccupied)
);

CREATE TABLE IF NOT EXISTS preoccupy (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku_id TEXT NOT NULL REFERENCES sku(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released', 'deducted')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'cancelled', 'closed', 'fulfilling', 'completed')),
  pay_amount_cents INTEGER NOT NULL CHECK (pay_amount_cents >= 0),
  price_snapshot_json TEXT NOT NULL,
  address_json TEXT,
  expire_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_line (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  sku_id TEXT NOT NULL REFERENCES sku(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  title TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preoccupy_order ON preoccupy(order_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_order_line_order ON order_line(order_id);

