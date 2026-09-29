PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK(channel IN ('email','phone')),
  identifier_hash TEXT NOT NULL UNIQUE,
  identifier_ciphertext TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified_at INTEGER,
  mfa_secret_ciphertext TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_codes_user ON verification_codes(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS login_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth_level TEXT NOT NULL CHECK(auth_level IN ('verified','full')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  profile_ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  condition TEXT NOT NULL,
  rate_cents INTEGER NOT NULL CHECK(rate_cents>0),
  deposit_cents INTEGER NOT NULL CHECK(deposit_cents>=0),
  approximate_lat REAL NOT NULL,
  approximate_lng REAL NOT NULL,
  photo_data TEXT,
  available INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tools_owner ON tools(owner_id);
CREATE TABLE IF NOT EXISTS rentals (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tools(id),
  renter_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('reserved','out','review','complete','disputed','cancelled')),
  days INTEGER NOT NULL CHECK(days BETWEEN 1 AND 30),
  rental_cents INTEGER NOT NULL,
  deposit_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  credits_used_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  payment_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  return_photo_ciphertext TEXT,
  assessment_json TEXT,
  handoff_method TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_rental ON rentals(tool_id) WHERE status IN ('reserved','out','review','disputed');
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  rental_id TEXT REFERENCES rentals(id),
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_user ON credit_ledger(user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS one_deposit_refund ON credit_ledger(rental_id) WHERE reason='deposit_refund';
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS message_pair ON messages(sender_id,recipient_id,created_at);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL UNIQUE REFERENCES rentals(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
