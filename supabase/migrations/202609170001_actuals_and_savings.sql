-- Additive metadata, calendar dates and standard savings; no financial data replaced.
alter table public.finance_planning add column goal_metadata jsonb not null default '{}';
alter table public.goals drop constraint goals_target_minor_check;
alter table public.goals drop constraint goals_check;
alter table public.goals add constraint goals_target_minor_check check (target_minor>0 or (target_minor=0 and lower(trim(name))='ahorros'));
alter table public.goals add constraint goals_check check (current_minor<=target_minor or (target_minor=0 and lower(trim(name))='ahorros'));
create or replace function public.get_finance_state() returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb; extra finance_planning; state jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  result := get_finance_state_v2();
  result := jsonb_set(result,'{state}',(result->'state') || jsonb_build_object('schemaVersion',3,'monthlyPlans','[]'::jsonb,'savingsAllocations','[]'::jsonb));
  select * into extra from finance_planning where user_id=auth.uid();
  if found then
    state := result->'state';
    state := state || jsonb_build_object('schemaVersion',3,'monthlyPlans',extra.monthly_plans,'savingsAllocations',extra.savings_allocations,'processedRequestIds',extra.processed_requests,
      'goals',coalesce((select jsonb_agg(value || coalesce(extra.goal_metadata->(value->>'id'),'{}')) from jsonb_array_elements(state->'goals')),'[]'),
      'transactions',coalesce((select jsonb_agg(value || coalesce(extra.transaction_metadata->(value->>'id'),'{}')) from jsonb_array_elements(state->'transactions')),'[]'),
      'savingsContributions',coalesce((select jsonb_agg(value || coalesce(extra.savings_metadata->(value->>'id'),'{}')) from jsonb_array_elements(state->'savingsContributions')),'[]'));
    if extra.categories is not null then state := state || jsonb_build_object('categories',extra.categories); end if;
    result := result || jsonb_build_object('state',state);
  end if;
  result := jsonb_set(result,'{state,profile}',(result#>'{state,profile}') || jsonb_build_object('timezone',coalesce((select timezone from profiles where user_id=auth.uid()),'America/La_Paz')));
  return result;
end $$;

create or replace function public.apply_finance_state(p_state jsonb,p_expected_revision bigint,p_operation_id text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare final_result jsonb; u uuid := auth.uid(); allocation jsonb; category jsonb; previous finance_planning; tx jsonb; existing_tx jsonb; today date; zone text;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  select a.result into final_result from applied_operations a where user_id=u and operation_id=p_operation_id;
  if found then return final_result; end if;
  select * into previous from finance_planning where user_id=u;
  zone := coalesce(p_state#>>'{profile,timezone}',(select timezone from profiles where user_id=u),'America/La_Paz');
  if not exists(select 1 from pg_timezone_names where name=zone) then zone := 'America/La_Paz'; end if;
  today := (now() at time zone zone)::date;
  for tx in select value from jsonb_array_elements(coalesce(p_state->'transactions','[]')) loop
    if (tx->>'date')::date > today then
      select jsonb_build_object('date',occurred_on,'amount',from_minor(amount_minor),'type',transaction_type,'accountId',account_id,'description',description) into existing_tx from transactions where user_id=u and id=tx->>'id' and deleted_at is null;
      if existing_tx is null or existing_tx <> jsonb_build_object('date',(tx->>'date')::date,'amount',(tx->>'amount')::numeric,'type',tx->>'type','accountId',tx->>'accountId','description',tx->>'description') then raise exception 'No puedes registrar movimientos con una fecha futura. Elige hoy o una fecha anterior.' using errcode='23514'; end if;
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
  update applied_operations set result=final_result where user_id=u and operation_id=p_operation_id;
  return final_result;
end $$;
revoke all on function public.get_finance_state() from public,anon;
revoke all on function public.apply_finance_state(jsonb,bigint,text) from public,anon;
grant execute on function public.get_finance_state() to authenticated;
grant execute on function public.apply_finance_state(jsonb,bigint,text) to authenticated;
