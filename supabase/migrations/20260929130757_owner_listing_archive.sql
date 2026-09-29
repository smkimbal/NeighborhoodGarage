-- Archive listings without breaking historical rentals, reviews, or condition evidence.
alter table public.tools add column archived_at timestamptz;
alter table public.tools add constraint archived_tools_unavailable check (archived_at is null or available=false);
-- Existing owner RLS and guard_tool trigger also protect archive/restore updates.
