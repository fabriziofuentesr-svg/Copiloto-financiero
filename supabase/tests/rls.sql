begin;
select plan(11);

insert into auth.users(id,aud,role,email,encrypted_password) values
  ('00000000-0000-0000-0000-00000000000a','authenticated','authenticated','a@example.test',''),
  ('00000000-0000-0000-0000-00000000000b','authenticated','authenticated','b@example.test','')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
insert into public.profiles(user_id,display_name) values ('00000000-0000-0000-0000-00000000000a','A');
insert into public.accounts(user_id,id,name,account_type,currency) values ('00000000-0000-0000-0000-00000000000a','a-cash','A cash','efectivo','BOB');

select is((select count(*)::integer from public.accounts),1,'A puede leer su cuenta');
select throws_ok($$insert into public.accounts(user_id,id,name,account_type,currency) values ('00000000-0000-0000-0000-00000000000b','bad','B','efectivo','BOB')$$,'42501',null,'A no puede insertar como B');

reset role;
insert into public.profiles(user_id,display_name) values ('00000000-0000-0000-0000-00000000000b','B');
insert into public.accounts(user_id,id,name,account_type,currency) values ('00000000-0000-0000-0000-00000000000b','b-cash','B cash','efectivo','BOB');
insert into public.transactions(user_id,id,transaction_type,description,amount_minor,currency,occurred_on,account_id) values ('00000000-0000-0000-0000-00000000000b','b-tx','ingreso','Privado',100,'BOB',current_date,'b-cash');
insert into public.goals(user_id,id,name,target_minor,current_minor,currency) values ('00000000-0000-0000-0000-00000000000b','b-goal','Meta B',10000,0,'BOB');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);

select is((select count(*)::integer from public.accounts),1,'A no puede leer cuentas de B');
select is((select count(*)::integer from public.transactions),0,'A no puede leer movimientos de B');
select lives_ok($$update public.accounts set name='hack' where user_id='00000000-0000-0000-0000-00000000000b'$$,'La actualización cruzada no afecta filas');
select lives_ok($$delete from public.accounts where user_id='00000000-0000-0000-0000-00000000000b'$$,'La eliminación cruzada no afecta filas');
select throws_ok($$insert into public.transactions(user_id,id,transaction_type,description,amount_minor,currency,occurred_on,account_id) values ('00000000-0000-0000-0000-00000000000a','cross','gasto','x',100,'BOB',current_date,'b-cash')$$,'23503',null,'A no puede relacionar una cuenta de B');
select throws_ok($$insert into public.savings_contributions(user_id,id,kind,goal_id,amount_minor,currency,contributed_on) values ('00000000-0000-0000-0000-00000000000a','cross-goal','goal','b-goal',100,'BOB',current_date)$$,'23503',null,'A no puede relacionar una meta de B');

reset role;
select is((select name from public.accounts where user_id='00000000-0000-0000-0000-00000000000b' and id='b-cash'),'B cash','La actualización de B fue bloqueada');
select is((select count(*)::integer from public.accounts where user_id='00000000-0000-0000-0000-00000000000b'),1,'La eliminación de B fue bloqueada');
set local role anon;
select is((select count(*)::integer from public.accounts),0,'Sin sesión no se leen cuentas');
select * from finish();
rollback;
