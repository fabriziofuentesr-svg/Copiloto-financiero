-- Esquema inicial no destructivo. Ejecutar primero en un proyecto local o de desarrollo.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', primary_currency char(3) not null default 'BOB' check (primary_currency in ('BOB','USD')),
  employment_type text not null default '', estimated_income_minor bigint not null default 0 check (estimated_income_minor >= 0),
  onboarding_completed boolean not null default false, timezone text not null default 'America/La_Paz', locale text not null default 'es-BO',
  data_revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  user_id uuid not null references auth.users(id) on delete cascade, id text not null,
  name text not null check (length(trim(name)) > 0), account_type text not null check (account_type in ('efectivo','ahorro','banco','billetera_digital','tarjeta_credito')),
  currency char(3) not null check (currency in ('BOB','USD')), opened_on date not null default current_date,
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  primary key (user_id,id), unique (id,user_id)
);

create table if not exists public.credit_cards (
  user_id uuid not null, account_id text not null, credit_limit_minor bigint check (credit_limit_minor is null or credit_limit_minor >= 0),
  statement_day smallint check (statement_day between 1 and 31), payment_day smallint check (payment_day between 1 and 31),
  minimum_payment_minor bigint check (minimum_payment_minor is null or minimum_payment_minor >= 0), annual_rate numeric(12,6) check (annual_rate is null or annual_rate between 0 and 300),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id,account_id), foreign key (account_id,user_id) references public.accounts(id,user_id) on delete restrict
);

create table if not exists public.transactions (
  user_id uuid not null references auth.users(id) on delete cascade, id text not null,
  transaction_type text not null check (transaction_type in ('ingreso','gasto','ajuste','transferencia')),
  description text not null, amount_minor bigint not null check (amount_minor > 0), currency char(3) not null check (currency in ('BOB','USD')),
  occurred_on date not null, category_code text, payment_method text, origin text not null default 'user', generated boolean not null default false,
  account_id text, recurring_id text, linked_debt_id text, transfer_group_id text, idempotency_key text,
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  primary key (user_id,id), unique (id,user_id), foreign key (account_id,user_id) references public.accounts(id,user_id) on delete restrict
);
create unique index if not exists transactions_idempotency_uidx on public.transactions(user_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists transactions_initial_balance_uidx on public.transactions(user_id,account_id) where origin='initial_balance' and deleted_at is null;
create index if not exists transactions_user_date_idx on public.transactions(user_id,occurred_on desc) where deleted_at is null;

create table if not exists public.transaction_entries (
  user_id uuid not null, id text not null, transaction_id text not null, account_id text not null,
  delta_minor bigint not null, currency char(3) not null check (currency in ('BOB','USD')), created_at timestamptz not null default now(),
  primary key (user_id,id), foreign key (transaction_id,user_id) references public.transactions(id,user_id) on delete cascade,
  foreign key (account_id,user_id) references public.accounts(id,user_id) on delete restrict
);
create index if not exists entries_account_idx on public.transaction_entries(user_id,account_id);

create table if not exists public.goals (
  user_id uuid not null references auth.users(id) on delete cascade, id text not null, name text not null,
  target_minor bigint not null check (target_minor > 0), current_minor bigint not null default 0 check (current_minor >= 0), currency char(3) not null check (currency in ('BOB','USD')),
  monthly_commitment_minor bigint not null default 0 check (monthly_commitment_minor >= 0), contribution_day smallint check (contribution_day between 1 and 31),
  target_on date, status text not null default 'active', version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  primary key(user_id,id), check (current_minor <= target_minor)
);

create table if not exists public.savings_contributions (
  user_id uuid not null references auth.users(id) on delete cascade, id text not null, kind text not null check (kind in ('goal','emergency')),
  goal_id text, amount_minor bigint not null check (amount_minor > 0), currency char(3) not null check (currency in ('BOB','USD')), contributed_on date not null,
  origin text not null default 'user', idempotency_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  primary key(user_id,id), foreign key (user_id,goal_id) references public.goals(user_id,id) on delete restrict
);

create table if not exists public.debts (
  user_id uuid not null references auth.users(id) on delete cascade, id text not null, name text not null, entity text not null default '', debt_type text not null default 'otro',
  principal_minor bigint not null check (principal_minor >= 0), balance_minor bigint not null check (balance_minor >= 0), currency char(3) not null check (currency in ('BOB','USD')),
  annual_rate numeric(12,6) not null default 0 check (annual_rate between 0 and 300), installment_minor bigint not null check (installment_minor >= 0),
  frequency text not null default 'mensual', payment_day smallint check (payment_day between 1 and 31), term_months integer, remaining_installments integer,
  linked_account_id text, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  primary key(user_id,id), foreign key (linked_account_id,user_id) references public.accounts(id,user_id) on delete restrict
);
create unique index if not exists debts_linked_card_uidx on public.debts(user_id,linked_account_id) where linked_account_id is not null and deleted_at is null;

create table if not exists public.recurring_transactions (
  user_id uuid not null references auth.users(id) on delete cascade, id text not null, kind text not null check (kind in ('ingreso','gasto')),
  name text not null, amount_minor bigint not null check (amount_minor > 0), currency char(3) not null check (currency in ('BOB','USD')), category_code text,
  account_id text, frequency text not null default 'mensual', day_of_month smallint check (day_of_month between 1 and 31), next_occurrence_on date,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  primary key(user_id,id), foreign key (account_id,user_id) references public.accounts(id,user_id) on delete restrict
);

create table if not exists public.user_financial_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emergency_current_minor bigint not null default 0 check (emergency_current_minor >= 0), emergency_months_target integer not null default 3 check (emergency_months_target > 0), emergency_configured boolean not null default false,
  essential_expenses_configured boolean not null default false, essential_category_ids text[] not null default '{}', savings_target_type text not null default 'percentage', savings_target_value numeric(18,6), debt_status text not null default 'unconfigured',
  expected_income_minor bigint, expected_variable_expenses_minor bigint, next_income_on date, income_frequency text not null default 'mensual',
  section_guides_seen jsonb not null default '{}', currency_history jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.local_import_batches (
  user_id uuid not null references auth.users(id) on delete cascade, migration_id text not null, fingerprint text not null,
  status text not null check (status in ('running','completed','failed')), summary jsonb not null default '{}',
  created_at timestamptz not null default now(), completed_at timestamptz, primary key(user_id,migration_id), unique(user_id,fingerprint)
);
create table if not exists public.applied_operations (
  user_id uuid not null references auth.users(id) on delete cascade, operation_id text not null, result jsonb,
  created_at timestamptz not null default now(), primary key(user_id,operation_id)
);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.credit_cards enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_entries enable row level security;
alter table public.goals enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.debts enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.user_financial_settings enable row level security;
alter table public.local_import_batches enable row level security;
alter table public.applied_operations enable row level security;

do $$ declare t text; begin
  foreach t in array array['profiles','accounts','credit_cards','transactions','transaction_entries','goals','savings_contributions','debts','recurring_transactions','user_financial_settings','local_import_batches','applied_operations'] loop
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t||'_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t||'_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t||'_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t||'_delete_own', t);
  end loop;
end $$;

create or replace function public.to_minor(value numeric) returns bigint language sql immutable security invoker set search_path=public as $$ select round(coalesce(value,0)*100)::bigint $$;
create or replace function public.from_minor(value bigint) returns numeric language sql immutable security invoker set search_path=public as $$ select coalesce(value,0)::numeric/100 $$;

create or replace function public.get_finance_state() returns jsonb language plpgsql security invoker set search_path=public as $$
declare u uuid := auth.uid(); p profiles; s user_financial_settings; result jsonb;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  insert into profiles(user_id) values(u) on conflict do nothing;
  insert into user_financial_settings(user_id) values(u) on conflict do nothing;
  select * into p from profiles where user_id=u; select * into s from user_financial_settings where user_id=u;
  select jsonb_build_object(
    'profile',jsonb_build_object('name',p.display_name,'currency',p.primary_currency,'employmentType',p.employment_type,'estimatedMonthlyIncome',from_minor(p.estimated_income_minor),'onboardingCompleted',p.onboarding_completed),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'type',a.account_type,'currency',a.currency,'balance',from_minor(coalesce(b.balance_minor,0)),'creditLimit',case when c.credit_limit_minor is null then null else from_minor(c.credit_limit_minor) end,'statementDay',c.statement_day,'paymentDay',c.payment_day,'minimumPayment',case when c.minimum_payment_minor is null then null else from_minor(c.minimum_payment_minor) end,'rate',c.annual_rate,'createdAt',a.created_at)) from accounts a left join credit_cards c on c.user_id=a.user_id and c.account_id=a.id left join (select e.user_id,e.account_id,sum(e.delta_minor) balance_minor from transaction_entries e join transactions tx on tx.user_id=e.user_id and tx.id=e.transaction_id and tx.deleted_at is null group by e.user_id,e.account_id) b on b.user_id=a.user_id and b.account_id=a.id where a.user_id=u and a.deleted_at is null),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'type',t.transaction_type,'description',t.description,'amount',from_minor(t.amount_minor),'date',t.occurred_on,'category',t.category_code,'paymentMethod',t.payment_method,'accountId',t.account_id,'linkedAccountId',t.account_id,'recurringId',t.recurring_id,'linkedDebtId',t.linked_debt_id,'transferGroupId',t.transfer_group_id,'origin',t.origin,'generated',t.generated,'balanceDelta',from_minor(e.delta_minor))) from transactions t left join transaction_entries e on e.user_id=t.user_id and e.transaction_id=t.id and e.account_id=t.account_id where t.user_id=u and t.deleted_at is null),'[]'::jsonb),
    'goals',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'target',from_minor(target_minor),'current',from_minor(current_minor),'monthlyContribution',from_minor(monthly_commitment_minor),'contributionDay',contribution_day,'targetDate',target_on)) from goals where user_id=u and deleted_at is null),'[]'::jsonb),
    'debts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'entity',entity,'type',debt_type,'principal',from_minor(principal_minor),'balance',from_minor(balance_minor),'rate',annual_rate,'installment',from_minor(installment_minor),'frequency',frequency,'paymentDay',payment_day,'termMonths',term_months,'remainingInstallments',remaining_installments,'linkedAccountId',linked_account_id)) from debts where user_id=u and deleted_at is null),'[]'::jsonb),
    'recurringExpenses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'amount',from_minor(amount_minor),'category',category_code,'accountId',account_id,'frequency',frequency,'dayOfMonth',day_of_month,'nextDate',next_occurrence_on,'active',active)) from recurring_transactions where user_id=u and kind='gasto' and deleted_at is null),'[]'::jsonb),
    'recurringIncomes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'amount',from_minor(amount_minor),'category',category_code,'accountId',account_id,'frequency',frequency,'dayOfMonth',day_of_month,'nextDate',next_occurrence_on,'active',active)) from recurring_transactions where user_id=u and kind='ingreso' and deleted_at is null),'[]'::jsonb),
    'savingsContributions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'linkedGoalId',goal_id,'amount',from_minor(amount_minor),'date',contributed_on,'origin',origin)) from savings_contributions where user_id=u and deleted_at is null),'[]'::jsonb),
    'emergencyFund',jsonb_build_object('current',from_minor(s.emergency_current_minor),'monthsTarget',s.emergency_months_target,'configured',s.emergency_configured),
    'financialSettings',jsonb_build_object('essentialExpensesConfigured',s.essential_expenses_configured,'essentialCategoryIds',to_jsonb(s.essential_category_ids),'savingsTargetType',s.savings_target_type,'savingsTargetValue',s.savings_target_value,'debtStatus',s.debt_status,'projection',jsonb_build_object('expectedMonthlyIncome',case when s.expected_income_minor is null then null else from_minor(s.expected_income_minor) end,'expectedVariableExpenses',case when s.expected_variable_expenses_minor is null then null else from_minor(s.expected_variable_expenses_minor) end,'nextIncomeDate',s.next_income_on,'incomeFrequency',s.income_frequency)),
    'sectionGuidesSeen',s.section_guides_seen,'currencyHistory',s.currency_history,'processedRequestIds','[]'::jsonb,'schemaVersion',2
  ) into result;
  return jsonb_build_object('revision',p.data_revision,'state',result);
end $$;

-- Sincroniza el agregado en una sola transacción PostgreSQL. Las restricciones y RLS
-- siguen aplicándose a cada tabla. Los IDs de cliente se conservan para migrar sin perder relaciones.
create or replace function public.apply_finance_state(p_state jsonb,p_expected_revision bigint,p_operation_id text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare u uuid:=auth.uid(); r jsonb; a jsonb; t jsonb; g jsonb; d jsonb; c jsonb; target bigint; actual bigint; delta bigint;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  select result into r from applied_operations where user_id=u and operation_id=p_operation_id; if found then return r; end if;
  insert into profiles(user_id) values(u) on conflict do nothing;
  perform 1 from profiles where user_id=u and data_revision=p_expected_revision for update;
  if not found then raise exception 'concurrent update' using errcode='40001'; end if;
  update profiles set display_name=coalesce(p_state#>>'{profile,name}',''),primary_currency=coalesce(p_state#>>'{profile,currency}','BOB'),employment_type=coalesce(p_state#>>'{profile,employmentType}',''),estimated_income_minor=to_minor((p_state#>>'{profile,estimatedMonthlyIncome}')::numeric),onboarding_completed=coalesce((p_state#>>'{profile,onboardingCompleted}')::boolean,false),data_revision=data_revision+1,updated_at=now() where user_id=u;
  for a in select * from jsonb_array_elements(coalesce(p_state->'accounts','[]')) loop
    insert into accounts(user_id,id,name,account_type,currency,opened_on,created_at,deleted_at) values(u,a->>'id',a->>'name',a->>'type',coalesce(a->>'currency',p_state#>>'{profile,currency}'),coalesce((a->>'createdAt')::timestamptz,now())::date,coalesce((a->>'createdAt')::timestamptz,now()),null)
    on conflict(user_id,id) do update set name=excluded.name,account_type=excluded.account_type,currency=excluded.currency,updated_at=now(),deleted_at=null,version=accounts.version+1;
    if a->>'type'='tarjeta_credito' then insert into credit_cards(user_id,account_id,credit_limit_minor,statement_day,payment_day,minimum_payment_minor,annual_rate) values(u,a->>'id',case when a->>'creditLimit' is null then null else to_minor((a->>'creditLimit')::numeric) end,(a->>'statementDay')::smallint,(a->>'paymentDay')::smallint,case when a->>'minimumPayment' is null then null else to_minor((a->>'minimumPayment')::numeric) end,(a->>'rate')::numeric) on conflict(user_id,account_id) do update set credit_limit_minor=excluded.credit_limit_minor,statement_day=excluded.statement_day,payment_day=excluded.payment_day,minimum_payment_minor=excluded.minimum_payment_minor,annual_rate=excluded.annual_rate,updated_at=now(); end if;
  end loop;
  delete from credit_cards c0 where user_id=u and exists (select 1 from accounts a0 where a0.user_id=u and a0.id=c0.account_id and a0.account_type<>'tarjeta_credito');
  update accounts a0 set deleted_at=now() where user_id=u and deleted_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_state->'accounts','[]')) x where x->>'id'=a0.id);
  for t in select * from jsonb_array_elements(coalesce(p_state->'transactions','[]')) loop
    insert into transactions(user_id,id,transaction_type,description,amount_minor,currency,occurred_on,category_code,payment_method,origin,generated,account_id,recurring_id,linked_debt_id,transfer_group_id,idempotency_key,deleted_at) values(u,t->>'id',t->>'type',t->>'description',to_minor((t->>'amount')::numeric),coalesce(t->>'currency',p_state#>>'{profile,currency}'),(t->>'date')::date,t->>'category',t->>'paymentMethod',coalesce(t->>'origin','user'),coalesce((t->>'generated')::boolean,false),t->>'accountId',t->>'recurringId',t->>'linkedDebtId',t->>'transferGroupId',case when t->>'origin'='initial_balance' then 'initial:'||(t->>'accountId') else null end,null)
    on conflict(user_id,id) do update set transaction_type=excluded.transaction_type,description=excluded.description,amount_minor=excluded.amount_minor,currency=excluded.currency,occurred_on=excluded.occurred_on,category_code=excluded.category_code,payment_method=excluded.payment_method,origin=excluded.origin,generated=excluded.generated,account_id=excluded.account_id,recurring_id=excluded.recurring_id,linked_debt_id=excluded.linked_debt_id,transfer_group_id=excluded.transfer_group_id,updated_at=now(),deleted_at=null,version=transactions.version+1;
    delta:=case when t ? 'balanceDelta' then to_minor((t->>'balanceDelta')::numeric) when t->>'type'='ingreso' then to_minor((t->>'amount')::numeric) when t->>'type'='gasto' then -to_minor((t->>'amount')::numeric) else 0 end;
    insert into transaction_entries(user_id,id,transaction_id,account_id,delta_minor,currency) values(u,(t->>'id')||':entry',t->>'id',t->>'accountId',delta,coalesce(t->>'currency',p_state#>>'{profile,currency}')) on conflict(user_id,id) do update set account_id=excluded.account_id,delta_minor=excluded.delta_minor,currency=excluded.currency;
  end loop;
  update transactions t0 set deleted_at=now() where user_id=u and deleted_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_state->'transactions','[]')) x where x->>'id'=t0.id);
  -- Concilia cuentas antiguas que tenían saldo pero carecían de libro completo.
  for a in select * from jsonb_array_elements(coalesce(p_state->'accounts','[]')) loop
    target:=to_minor((a->>'balance')::numeric); select coalesce(sum(e.delta_minor),0) into actual from transaction_entries e join transactions x on x.user_id=e.user_id and x.id=e.transaction_id where e.user_id=u and e.account_id=a->>'id' and x.deleted_at is null;
    delta:=target-actual; if delta<>0 then
      insert into transactions(user_id,id,transaction_type,description,amount_minor,currency,occurred_on,category_code,origin,generated,account_id,idempotency_key) values(u,(a->>'id')||'-migration-balance','ajuste','Ajuste de migración — '||(a->>'name'),abs(delta),coalesce(a->>'currency','BOB'),current_date,'ajuste_saldo','migration_balance',true,a->>'id','migration-balance:'||(a->>'id')) on conflict(user_id,id) do update set amount_minor=excluded.amount_minor,deleted_at=null;
      insert into transaction_entries(user_id,id,transaction_id,account_id,delta_minor,currency) values(u,(a->>'id')||'-migration-balance:entry',(a->>'id')||'-migration-balance',a->>'id',delta,coalesce(a->>'currency','BOB')) on conflict(user_id,id) do update set delta_minor=excluded.delta_minor;
    end if;
  end loop;
  for g in select * from jsonb_array_elements(coalesce(p_state->'goals','[]')) loop insert into goals(user_id,id,name,target_minor,current_minor,currency,monthly_commitment_minor,contribution_day,target_on,deleted_at) values(u,g->>'id',g->>'name',to_minor((g->>'target')::numeric),to_minor((g->>'current')::numeric),p_state#>>'{profile,currency}',to_minor((g->>'monthlyContribution')::numeric),(g->>'contributionDay')::smallint,(g->>'targetDate')::date,null) on conflict(user_id,id) do update set name=excluded.name,target_minor=excluded.target_minor,current_minor=excluded.current_minor,monthly_commitment_minor=excluded.monthly_commitment_minor,updated_at=now(),deleted_at=null; end loop;
  update goals g0 set deleted_at=now() where user_id=u and deleted_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_state->'goals','[]')) x where x->>'id'=g0.id);
  for d in select * from jsonb_array_elements(coalesce(p_state->'debts','[]')) loop insert into debts(user_id,id,name,entity,debt_type,principal_minor,balance_minor,currency,annual_rate,installment_minor,frequency,payment_day,term_months,remaining_installments,linked_account_id,deleted_at) values(u,d->>'id',d->>'name',coalesce(d->>'entity',''),coalesce(d->>'type','otro'),to_minor((d->>'principal')::numeric),to_minor((d->>'balance')::numeric),p_state#>>'{profile,currency}',coalesce((d->>'rate')::numeric,0),to_minor((d->>'installment')::numeric),coalesce(d->>'frequency','mensual'),(d->>'paymentDay')::smallint,(d->>'termMonths')::integer,(d->>'remainingInstallments')::integer,d->>'linkedAccountId',null) on conflict(user_id,id) do update set name=excluded.name,entity=excluded.entity,balance_minor=excluded.balance_minor,annual_rate=excluded.annual_rate,installment_minor=excluded.installment_minor,payment_day=excluded.payment_day,linked_account_id=excluded.linked_account_id,updated_at=now(),deleted_at=null; end loop;
  update debts d0 set deleted_at=now() where user_id=u and deleted_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_state->'debts','[]')) x where x->>'id'=d0.id);
  for c in select value||jsonb_build_object('kind','gasto') from jsonb_array_elements(coalesce(p_state->'recurringExpenses','[]')) loop insert into recurring_transactions(user_id,id,kind,name,amount_minor,currency,category_code,account_id,frequency,day_of_month,next_occurrence_on,active,deleted_at) values(u,c->>'id','gasto',c->>'name',to_minor((c->>'amount')::numeric),p_state#>>'{profile,currency}',c->>'category',c->>'accountId',coalesce(c->>'frequency','mensual'),(c->>'dayOfMonth')::smallint,(c->>'nextDate')::date,coalesce((c->>'active')::boolean,true),null) on conflict(user_id,id) do update set kind='gasto',name=excluded.name,amount_minor=excluded.amount_minor,category_code=excluded.category_code,account_id=excluded.account_id,frequency=excluded.frequency,day_of_month=excluded.day_of_month,next_occurrence_on=excluded.next_occurrence_on,active=excluded.active,updated_at=now(),deleted_at=null; end loop;
  for c in select value||jsonb_build_object('kind','ingreso') from jsonb_array_elements(coalesce(p_state->'recurringIncomes','[]')) loop insert into recurring_transactions(user_id,id,kind,name,amount_minor,currency,category_code,account_id,frequency,day_of_month,next_occurrence_on,active,deleted_at) values(u,c->>'id','ingreso',c->>'name',to_minor((c->>'amount')::numeric),p_state#>>'{profile,currency}',c->>'category',c->>'accountId',coalesce(c->>'frequency','mensual'),(c->>'dayOfMonth')::smallint,(c->>'nextDate')::date,coalesce((c->>'active')::boolean,true),null) on conflict(user_id,id) do update set kind='ingreso',name=excluded.name,amount_minor=excluded.amount_minor,category_code=excluded.category_code,account_id=excluded.account_id,frequency=excluded.frequency,day_of_month=excluded.day_of_month,next_occurrence_on=excluded.next_occurrence_on,active=excluded.active,updated_at=now(),deleted_at=null; end loop;
  update recurring_transactions r0 set deleted_at=now() where user_id=u and deleted_at is null and not exists (select 1 from (select value from jsonb_array_elements(coalesce(p_state->'recurringExpenses','[]')) union all select value from jsonb_array_elements(coalesce(p_state->'recurringIncomes','[]'))) x where x.value->>'id'=r0.id);
  for c in select * from jsonb_array_elements(coalesce(p_state->'savingsContributions','[]')) loop insert into savings_contributions(user_id,id,kind,goal_id,amount_minor,currency,contributed_on,origin,deleted_at) values(u,c->>'id',c->>'kind',c->>'linkedGoalId',to_minor((c->>'amount')::numeric),p_state#>>'{profile,currency}',(c->>'date')::date,coalesce(c->>'origin','user'),null) on conflict(user_id,id) do update set amount_minor=excluded.amount_minor,contributed_on=excluded.contributed_on,updated_at=now(),deleted_at=null; end loop;
  update savings_contributions c0 set deleted_at=now() where user_id=u and deleted_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_state->'savingsContributions','[]')) x where x->>'id'=c0.id);
  insert into user_financial_settings(user_id,emergency_current_minor,emergency_months_target,emergency_configured,essential_expenses_configured,essential_category_ids,savings_target_type,savings_target_value,debt_status,expected_income_minor,expected_variable_expenses_minor,next_income_on,income_frequency,section_guides_seen,currency_history) values(u,to_minor((p_state#>>'{emergencyFund,current}')::numeric),coalesce((p_state#>>'{emergencyFund,monthsTarget}')::integer,3),coalesce((p_state#>>'{emergencyFund,configured}')::boolean,false),coalesce((p_state#>>'{financialSettings,essentialExpensesConfigured}')::boolean,false),array(select jsonb_array_elements_text(coalesce(p_state#>'{financialSettings,essentialCategoryIds}','[]'))),coalesce(p_state#>>'{financialSettings,savingsTargetType}','percentage'),(p_state#>>'{financialSettings,savingsTargetValue}')::numeric,coalesce(p_state#>>'{financialSettings,debtStatus}','unconfigured'),case when p_state#>>'{financialSettings,projection,expectedMonthlyIncome}' is null then null else to_minor((p_state#>>'{financialSettings,projection,expectedMonthlyIncome}')::numeric) end,case when p_state#>>'{financialSettings,projection,expectedVariableExpenses}' is null then null else to_minor((p_state#>>'{financialSettings,projection,expectedVariableExpenses}')::numeric) end,(p_state#>>'{financialSettings,projection,nextIncomeDate}')::date,coalesce(p_state#>>'{financialSettings,projection,incomeFrequency}','mensual'),coalesce(p_state->'sectionGuidesSeen','{}'),coalesce(p_state->'currencyHistory','[]')) on conflict(user_id) do update set emergency_current_minor=excluded.emergency_current_minor,emergency_months_target=excluded.emergency_months_target,emergency_configured=excluded.emergency_configured,essential_expenses_configured=excluded.essential_expenses_configured,essential_category_ids=excluded.essential_category_ids,savings_target_type=excluded.savings_target_type,savings_target_value=excluded.savings_target_value,debt_status=excluded.debt_status,expected_income_minor=excluded.expected_income_minor,expected_variable_expenses_minor=excluded.expected_variable_expenses_minor,next_income_on=excluded.next_income_on,income_frequency=excluded.income_frequency,section_guides_seen=excluded.section_guides_seen,currency_history=excluded.currency_history,updated_at=now();
  r:=get_finance_state(); insert into applied_operations(user_id,operation_id,result) values(u,p_operation_id,r); return r;
end $$;

create or replace function public.has_finance_data() returns boolean language sql security invoker set search_path=public as $$
  select exists(select 1 from profiles where user_id=auth.uid() and onboarding_completed)
    or exists(select 1 from accounts where user_id=auth.uid() and deleted_at is null)
    or exists(select 1 from transactions where user_id=auth.uid() and deleted_at is null)
    or exists(select 1 from goals where user_id=auth.uid() and deleted_at is null)
    or exists(select 1 from debts where user_id=auth.uid() and deleted_at is null)
    or exists(select 1 from recurring_transactions where user_id=auth.uid() and deleted_at is null);
$$;
create or replace function public.get_local_import_status(p_fingerprint text) returns jsonb language sql stable security invoker set search_path=public as $$
  select (select jsonb_build_object('migrationId',migration_id,'status',status,'summary',summary,'completedAt',completed_at)
    from local_import_batches where user_id=auth.uid() and fingerprint=p_fingerprint limit 1);
$$;
create or replace function public.import_local_finance_state(p_state jsonb,p_migration_id text,p_fingerprint text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare u uuid:=auth.uid(); existing local_import_batches; revision bigint; result jsonb;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into existing from local_import_batches where user_id=u and (migration_id=p_migration_id or fingerprint=p_fingerprint);
  if found and existing.status='completed' then return get_finance_state()||jsonb_build_object('alreadyImported',true); end if;
  if has_finance_data() then raise exception 'remote data exists' using errcode='P0001'; end if;
  insert into profiles(user_id) values(u) on conflict do nothing; select data_revision into revision from profiles where user_id=u;
  insert into local_import_batches(user_id,migration_id,fingerprint,status,summary) values(u,p_migration_id,p_fingerprint,'running',jsonb_build_object('accounts',jsonb_array_length(coalesce(p_state->'accounts','[]')),'transactions',jsonb_array_length(coalesce(p_state->'transactions','[]')))) on conflict(user_id,migration_id) do update set status='running';
  result:=apply_finance_state(p_state,revision,'import:'||p_migration_id);
  update local_import_batches set status='completed',completed_at=now() where user_id=u and migration_id=p_migration_id;
  return result||jsonb_build_object('alreadyImported',false,'migrationId',p_migration_id);
end $$;

revoke all on function public.get_finance_state() from public,anon;
revoke all on function public.apply_finance_state(jsonb,bigint,text) from public,anon;
revoke all on function public.import_local_finance_state(jsonb,text,text) from public,anon;
revoke all on function public.has_finance_data() from public,anon;
revoke all on function public.get_local_import_status(text) from public,anon;
revoke all on function public.to_minor(numeric) from public,anon;
revoke all on function public.from_minor(bigint) from public,anon;
-- Supabase puede crear esta función para habilitar RLS en tablas nuevas. El event
-- trigger puede utilizarla como propietario, pero clientes de la API no deben invocarla.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $$;
grant execute on function public.get_finance_state() to authenticated;
grant execute on function public.apply_finance_state(jsonb,bigint,text) to authenticated;
grant execute on function public.import_local_finance_state(jsonb,text,text) to authenticated;
grant execute on function public.has_finance_data() to authenticated;
grant execute on function public.get_local_import_status(text) to authenticated;
grant execute on function public.to_minor(numeric) to authenticated;
grant execute on function public.from_minor(bigint) to authenticated;
