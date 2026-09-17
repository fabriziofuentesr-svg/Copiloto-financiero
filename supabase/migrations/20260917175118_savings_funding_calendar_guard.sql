-- Additive validation only: no stored financial records are rewritten.
create or replace function public.savings_location_delta(events jsonb,goal_id text,account_id text)
returns numeric language sql immutable security invoker set search_path=public as $$
 select coalesce(sum(
  (case when x->>'linkedGoalId'=goal_id and x->>'accountId'=account_id then case when x->>'method'='release' then -1 else 1 end * (x->>'amount')::numeric else 0 end)
  -(case when x->>'method'='reassign' and x->>'sourceGoalId'=goal_id and x->>'accountId'=account_id then (x->>'amount')::numeric else 0 end)
  -(case when x->>'method'='move' and x->>'linkedGoalId'=goal_id and x->>'sourceAccountId'=account_id then (x->>'amount')::numeric else 0 end)
 ),0) from jsonb_array_elements(events) x;
$$;
create or replace function public.apply_finance_state(p_state jsonb,p_expected_revision bigint,p_operation_id text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare final_result jsonb; u uuid := auth.uid(); allocation jsonb; category jsonb; previous finance_planning; tx jsonb; existing_tx jsonb; today date; zone text; old_state jsonb; r jsonb; row jsonb; a jsonb; balance numeric; reserved numeric; old_reserved numeric; old_balance numeric; location record; expected numeric;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  select a.result into final_result from applied_operations a where user_id=u and operation_id=p_operation_id;
  if found then return final_result; end if;
  old_state := get_finance_state()->'state';
  select * into previous from finance_planning where user_id=u;
  zone := coalesce(p_state#>>'{profile,timezone}',(select timezone from profiles where user_id=u),'America/La_Paz');
  if not exists(select 1 from pg_timezone_names where name=zone) then zone := 'America/La_Paz'; end if;
  today := (now() at time zone zone)::date;
  for tx in select value from jsonb_array_elements(coalesce(p_state->'transactions','[]')) loop
    if (tx->>'date')::date > today then
      select jsonb_build_object('date',occurred_on,'amount',from_minor(amount_minor),'type',transaction_type,'accountId',account_id,'description',description) into existing_tx from transactions where user_id=u and id=tx->>'id' and deleted_at is null;
      if coalesce(previous.transaction_metadata#>array[tx->>'id','savingsFunding'],'null'::jsonb) is distinct from coalesce(tx->'savingsFunding','null'::jsonb) or existing_tx is null or existing_tx <> jsonb_build_object('date',(tx->>'date')::date,'amount',(tx->>'amount')::numeric,'type',tx->>'type','accountId',tx->>'accountId','description',tx->>'description') then raise exception 'No puedes registrar movimientos con una fecha futura. Elige hoy o una fecha anterior.' using errcode='23514'; end if;
    end if;
  end loop;
  final_result := apply_finance_state_v2(p_state,p_expected_revision,p_operation_id);
  for allocation in select value from jsonb_array_elements(coalesce(p_state->'savingsAllocations',previous.savings_allocations,'[]')) loop
    if coalesce((allocation->>'amount')::numeric,-1) < 0 or not exists(select 1 from accounts where user_id=u and id=allocation->>'accountId' and deleted_at is null)
       or not exists(select 1 from goals where user_id=u and id=allocation->>'goalId' and deleted_at is null) then
      raise exception 'invalid savings allocation' using errcode='23514';
    end if;
  end loop;
  for category in select value from jsonb_array_elements(coalesce(p_state->'categories','[]')) loop
    if coalesce(category->>'type','') not in ('ingreso','gasto') or (category->>'type'='gasto' and coalesce(category->>'classification','') not in ('fijo','variable')) then
      raise exception 'invalid category classification' using errcode='23514';
    end if;
  end loop;
  insert into finance_planning(user_id,categories,monthly_plans,savings_allocations,transaction_metadata,savings_metadata,processed_requests)
  values(u,p_state->'categories',coalesce(p_state->'monthlyPlans',previous.monthly_plans,'[]'),coalesce(p_state->'savingsAllocations',previous.savings_allocations,'[]'),
    coalesce((select jsonb_object_agg(value->>'id',coalesce(previous.transaction_metadata->(value->>'id'),'{}') || (value - array['amount','balanceDelta','accountId','category','date','type','description','origin','generated','linkedDebtId','transferGroupId','recurringId','paymentMethod'])) from jsonb_array_elements(coalesce(p_state->'transactions','[]'))),'{}'),
    coalesce((select jsonb_object_agg(value->>'id',coalesce(previous.savings_metadata->(value->>'id'),'{}') || (value - array['amount','date','kind','origin','linkedGoalId'])) from jsonb_array_elements(coalesce(p_state->'savingsContributions','[]'))),'{}'),coalesce(p_state->'processedRequestIds',previous.processed_requests,'[]'))
  on conflict(user_id) do update set categories=coalesce(excluded.categories,finance_planning.categories),monthly_plans=excluded.monthly_plans,savings_allocations=excluded.savings_allocations,transaction_metadata=excluded.transaction_metadata,savings_metadata=excluded.savings_metadata,processed_requests=excluded.processed_requests;
  update finance_planning set goal_metadata=coalesce((select jsonb_object_agg(value->>'id',value - array['name','target','current','monthlyContribution','contributionDay','targetDate']) from jsonb_array_elements(coalesce(p_state->'goals','[]'))),'{}') where user_id=u;
  update profiles set timezone=zone where user_id=u;
  final_result := get_finance_state();
  r := final_result;
 if exists(select 1 from jsonb_array_elements(coalesce(p_state->'savingsAllocations','[]')) x group by x->>'accountId',x->>'goalId' having count(*)>1) then
  raise exception 'duplicate savings allocation' using errcode='23514';
 end if;
 for a in select value from jsonb_array_elements(r#>'{state,accounts}') loop
  select coalesce(sum((x->>'amount')::numeric),0) into reserved from jsonb_array_elements(r#>'{state,savingsAllocations}') x where x->>'accountId'=a->>'id';
  balance := (a->>'balance')::numeric;
  select coalesce(sum((x->>'amount')::numeric),0) into old_reserved from jsonb_array_elements(coalesce(old_state->'savingsAllocations','[]')) x where x->>'accountId'=a->>'id';
  select coalesce((x->>'balance')::numeric,0) into old_balance from jsonb_array_elements(coalesce(old_state->'accounts','[]')) x where x->>'id'=a->>'id';
  if (a->>'type'='tarjeta_credito' and reserved>0) or greatest(0,reserved-greatest(0,balance))>greatest(0,old_reserved-greatest(0,coalesce(old_balance,0))) then
   raise exception 'La reserva supera el saldo de su cuenta.' using errcode='23514';
  end if;
 end loop;
 for tx in select value from jsonb_array_elements(p_state->'transactions') loop
  if tx->'savingsFunding' is not null and tx->'savingsFunding'<>'null'::jsonb then
   row:=tx->'savingsFunding';
   if tx->>'type'<>'gasto' or row->>'accountId' is distinct from tx->>'accountId'
      or coalesce((row->>'amount')::numeric,-1)<0 or (row->>'amount')::numeric>(tx->>'amount')::numeric
      or not exists(select 1 from goals where user_id=auth.uid() and id=row->>'goalId' and deleted_at is null)
      or not exists(select 1 from accounts where user_id=auth.uid() and id=row->>'accountId' and account_type<>'tarjeta_credito' and deleted_at is null) then
    raise exception 'invalid savings-funded expense' using errcode='23514';
   end if;
  end if;
 end loop;

  if jsonb_array_length(coalesce(old_state->'accounts','[]'))>0 then
   for location in
    select x->>'goalId' goal_id,x->>'accountId' account_id from jsonb_array_elements(coalesce(old_state->'savingsAllocations','[]')) x
    union select x->>'goalId',x->>'accountId' from jsonb_array_elements(coalesce(p_state->'savingsAllocations','[]')) x
    union select x#>>'{savingsFunding,goalId}',x->>'accountId' from jsonb_array_elements(p_state->'transactions') x where x#>>'{savingsFunding,goalId}' is not null
    union select x#>>'{savingsFunding,goalId}',x->>'accountId' from jsonb_array_elements(old_state->'transactions') x where x#>>'{savingsFunding,goalId}' is not null
   loop
    select coalesce(sum((x->>'amount')::numeric),0) into old_reserved from jsonb_array_elements(coalesce(old_state->'savingsAllocations','[]')) x where x->>'goalId'=location.goal_id and x->>'accountId'=location.account_id;
    select coalesce(sum((x->>'amount')::numeric),0) into reserved from jsonb_array_elements(coalesce(p_state->'savingsAllocations','[]')) x where x->>'goalId'=location.goal_id and x->>'accountId'=location.account_id;
    expected := old_reserved
     + public.savings_location_delta(coalesce(p_state->'savingsContributions','[]'),location.goal_id,location.account_id)
     - public.savings_location_delta(coalesce(old_state->'savingsContributions','[]'),location.goal_id,location.account_id)
     - coalesce((select sum((x#>>'{savingsFunding,amount}')::numeric) from jsonb_array_elements(p_state->'transactions') x where x#>>'{savingsFunding,goalId}'=location.goal_id and x->>'accountId'=location.account_id),0)
     + coalesce((select sum((x#>>'{savingsFunding,amount}')::numeric) from jsonb_array_elements(old_state->'transactions') x where x#>>'{savingsFunding,goalId}'=location.goal_id and x->>'accountId'=location.account_id),0);
    if round(expected,2)<>round(reserved,2) or expected<0 then raise exception 'Savings allocation does not reconcile to contributions and expenses.' using errcode='23514'; end if;
   end loop;
  end if;
  final_result:=jsonb_set(final_result,'{state,schemaVersion}','4'::jsonb);

  update applied_operations set result=final_result where user_id=u and operation_id=p_operation_id;
  return final_result;
end $$;
