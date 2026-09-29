-- PostgreSQL/Supabase-oriented production schema scaffold.
-- Apply only after auth/RLS policies are reviewed and tested.
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  public_display_name text NOT NULL,
  profile_ciphertext bytea NOT NULL,
  encryption_key_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tools (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  condition text NOT NULL,
  rate_cents integer NOT NULL CHECK(rate_cents>0),
  deposit_cents integer NOT NULL CHECK(deposit_cents>=0),
  approximate_lat double precision,
  approximate_lng double precision,
  baseline_object_key text NOT NULL,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rentals (
  id uuid PRIMARY KEY,
  tool_id text NOT NULL REFERENCES tools(id),
  renter_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL CHECK(status IN ('reserved','out','review','complete','disputed','cancelled')),
  days integer NOT NULL CHECK(days BETWEEN 1 AND 30),
  rental_cents integer NOT NULL,
  deposit_cents integer NOT NULL,
  fee_cents integer NOT NULL,
  credits_used_cents integer NOT NULL DEFAULT 0,
  amount_due_cents integer NOT NULL DEFAULT 0,
  payment_reference text,
  idempotency_key uuid UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_rental ON rentals(tool_id) WHERE status IN ('reserved','out','review','disputed');
CREATE TABLE scans (
  id uuid PRIMARY KEY,
  rental_id uuid REFERENCES rentals(id),
  tool_id text NOT NULL REFERENCES tools(id),
  object_key text NOT NULL,
  stage text NOT NULL CHECK(stage IN ('baseline','return')),
  model_version text,
  assessment jsonb,
  owner_decision text CHECK(owner_decision IN ('approve','dispute')),
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE credit_ledger (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id),
  rental_id uuid REFERENCES rentals(id),
  amount_cents integer NOT NULL,
  reason text NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_deposit_refund ON credit_ledger(rental_id) WHERE reason='deposit_refund';
CREATE TABLE messages (
  id uuid PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  recipient_id uuid NOT NULL REFERENCES profiles(id),
  rental_id uuid REFERENCES rentals(id),
  ciphertext bytea NOT NULL,
  encryption_key_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reviews (
  id uuid PRIMARY KEY,
  rental_id uuid UNIQUE NOT NULL REFERENCES rentals(id),
  author_id uuid NOT NULL REFERENCES profiles(id),
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
-- Intentionally deny-by-default until ownership/participant policies are added and tested.
