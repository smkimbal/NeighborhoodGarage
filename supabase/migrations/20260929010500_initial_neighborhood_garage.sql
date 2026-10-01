create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', neighborhood text not null default '', city text not null default '', state text not null default '',
  bio text not null default '', avatar_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint profiles_display_name_len check (char_length(display_name)<=60), constraint profiles_bio_len check (char_length(bio)<=500)
);
create table public.tools (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, category text not null, description text not null default '', condition text not null default '',
  rate_cents integer not null check(rate_cents>0), deposit_cents integer not null check(deposit_cents>=0), approximate_lat double precision, approximate_lng double precision,
  photo_path text, available boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  tracking_code text generated always as ('NG'||upper(substr(replace(id::text,'-',''),1,8))) stored,
  constraint tools_title_len check(char_length(title) between 2 and 100), constraint tools_description_len check(char_length(description)<=2000), constraint tools_condition_len check(char_length(condition)<=1000)
);
create unique index tools_tracking_code_idx on public.tools(tracking_code);
create index tools_owner_id_idx on public.tools(owner_id);
create table public.rentals (
  id uuid primary key default gen_random_uuid(), tool_id uuid not null references public.tools(id), renter_id uuid not null references public.profiles(id), owner_id uuid not null references public.profiles(id),
  status text not null check(status in('pending_payment','reserved','out','review','complete','disputed','cancelled','payment_failed')), days integer not null check(days between 1 and 30),
  rental_cents integer not null check(rental_cents>=0), deposit_cents integer not null check(deposit_cents>=0), fee_cents integer not null check(fee_cents>=0),
  credits_used_cents integer not null default 0 check(credits_used_cents>=0), amount_due_cents integer not null check(amount_due_cents>=0),
  stripe_checkout_session_id text unique, stripe_payment_intent_id text unique, return_photo_path text, assessment jsonb, handoff_method text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);
create unique index rentals_one_active_tool on public.rentals(tool_id) where status in('pending_payment','reserved','out','review','disputed');
create index rentals_renter_id_idx on public.rentals(renter_id); create index rentals_owner_id_idx on public.rentals(owner_id);
create table public.credit_ledger (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, rental_id uuid references public.rentals(id) on delete set null, amount_cents integer not null, reason text not null, idempotency_key text not null unique, created_at timestamptz not null default now());
create index credit_ledger_user_created_idx on public.credit_ledger(user_id,created_at desc); create index credit_ledger_rental_id_idx on public.credit_ledger(rental_id);
create table public.messages (id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade, recipient_id uuid not null references public.profiles(id) on delete cascade, rental_id uuid references public.rentals(id) on delete set null, body text not null, created_at timestamptz not null default now(), constraint messages_body_len check(char_length(body) between 1 and 2000), constraint messages_not_self check(sender_id<>recipient_id));
create index messages_participants_idx on public.messages(sender_id,recipient_id,created_at); create index messages_recipient_id_idx on public.messages(recipient_id); create index messages_rental_id_idx on public.messages(rental_id);
create table public.reviews (id uuid primary key default gen_random_uuid(), rental_id uuid not null unique references public.rentals(id) on delete cascade, author_id uuid not null references public.profiles(id) on delete cascade, rating integer not null check(rating between 1 and 5), body text not null default '', created_at timestamptz not null default now(), constraint reviews_body_len check(char_length(body)<=1000));
create index reviews_author_id_idx on public.reviews(author_id);
create table public.payment_events (id text primary key,event_type text not null,payload jsonb not null,processed_at timestamptz not null default now());

create or replace function public.handle_new_user() returns trigger language plpgsql security invoker set search_path='' as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')) on conflict(id) do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger tools_set_updated_at before update on public.tools for each row execute procedure public.set_updated_at();
create trigger rentals_set_updated_at before update on public.rentals for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security; alter table public.tools enable row level security; alter table public.rentals enable row level security; alter table public.credit_ledger enable row level security; alter table public.messages enable row level security; alter table public.reviews enable row level security; alter table public.payment_events enable row level security;
grant usage on schema public to authenticated; grant select on public.profiles,public.tools,public.rentals,public.credit_ledger,public.messages,public.reviews to authenticated; grant update on public.profiles to authenticated; grant insert,update,delete on public.tools to authenticated; grant insert on public.messages,public.reviews to authenticated; revoke all on public.payment_events from anon,authenticated; revoke insert,update,delete on public.rentals,public.credit_ledger from anon,authenticated;
create policy "profiles visible to signed in users" on public.profiles for select to authenticated using(true);
create policy "users update own profile" on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy "tools visible to signed in users" on public.tools for select to authenticated using(true);
create policy "owners insert tools" on public.tools for insert to authenticated with check((select auth.uid())=owner_id);
create policy "owners update tools" on public.tools for update to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id);
create policy "owners delete tools" on public.tools for delete to authenticated using((select auth.uid())=owner_id);
create policy "rental participants view rentals" on public.rentals for select to authenticated using((select auth.uid()) in(renter_id,owner_id));
create policy "users view own credits" on public.credit_ledger for select to authenticated using((select auth.uid())=user_id);
create policy "message participants view" on public.messages for select to authenticated using((select auth.uid()) in(sender_id,recipient_id));
create policy "users send messages as self" on public.messages for insert to authenticated with check((select auth.uid())=sender_id);
create policy "reviews visible to signed in users" on public.reviews for select to authenticated using(true);
create policy "renters review completed rentals" on public.reviews for insert to authenticated with check((select auth.uid())=author_id and exists(select 1 from public.rentals r where r.id=rental_id and r.renter_id=(select auth.uid()) and r.status='complete'));
create policy "no client payment event access" on public.payment_events for all to authenticated using(false) with check(false);

do $$ declare t text; begin foreach t in array array['profiles','tools','rentals','credit_ledger','messages','reviews'] loop execute format($p$create policy %I on public.%I as restrictive for all to authenticated using(array[((select auth.jwt())->>'aal')] <@ (select case when count(id)>0 then array['aal2'] else array['aal1','aal2'] end from auth.mfa_factors where user_id=(select auth.uid()) and status='verified')) with check(array[((select auth.jwt())->>'aal')] <@ (select case when count(id)>0 then array['aal2'] else array['aal1','aal2'] end from auth.mfa_factors where user_id=(select auth.uid()) and status='verified'))$p$,'mfa required when enrolled',t); end loop; end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('tool-photos','tool-photos',false,8388608,array['image/jpeg','image/png','image/webp']),('return-photos','return-photos',false,8388608,array['image/jpeg','image/png','image/webp']),('avatars','avatars',false,4194304,array['image/jpeg','image/png','image/webp']);
create policy "authenticated view tool photos" on storage.objects for select to authenticated using(bucket_id='tool-photos');
create policy "owners upload tool photos" on storage.objects for insert to authenticated with check(bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "owners manage tool photos" on storage.objects for update to authenticated using(bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "owners delete tool photos" on storage.objects for delete to authenticated using(bucket_id='tool-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "users upload returns" on storage.objects for insert to authenticated with check(bucket_id='return-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "rental participants view returns" on storage.objects for select to authenticated using(bucket_id='return-photos' and exists(select 1 from public.rentals r where r.return_photo_path=name and (select auth.uid()) in(r.renter_id,r.owner_id)));
create policy "users manage own avatar" on storage.objects for all to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "authenticated view avatars" on storage.objects for select to authenticated using(bucket_id='avatars');
alter publication supabase_realtime add table public.messages;
