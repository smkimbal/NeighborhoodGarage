-- Public recognition exposes aggregate activity only, never private rental or payment records.
create or replace function public.reputation_summary(p_ids uuid[])
returns table(user_id uuid, listed bigint, borrowed bigint, lent bigint, review_count bigint, rating numeric)
language sql stable security definer set search_path = '' as $$
  select p.id,
    (select count(*) from public.tools t where t.owner_id=p.id),
    (select count(*) from public.rentals r where r.renter_id=p.id and r.status='complete'),
    (select count(*) from public.rentals r where r.owner_id=p.id and r.status='complete'),
    (select count(*) from public.reviews v where v.subject_id=p.id),
    (select coalesce(avg(v.rating),0) from public.reviews v where v.subject_id=p.id)
  from public.profiles p
  where p.id = any(p_ids)
    and (select private.session_allowed())
    and cardinality(p_ids) between 1 and 50;
$$;
revoke all on function public.reputation_summary(uuid[]) from public, anon;
grant execute on function public.reputation_summary(uuid[]) to authenticated;
