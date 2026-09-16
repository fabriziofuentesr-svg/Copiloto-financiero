-- PostgreSQL SUM(bigint) returns numeric. Keep exact cents without casting
-- aggregated balances back to bigint or changing the existing overload.
create function public.from_minor(value numeric) returns numeric
language sql immutable security invoker set search_path=public
as $$ select coalesce(value,0)/100 $$;
revoke all on function public.from_minor(numeric) from public,anon;
grant execute on function public.from_minor(numeric) to authenticated;
