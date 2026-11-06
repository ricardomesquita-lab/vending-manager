alter table public.cash_closures
  add column if not exists period_start_date date;

update public.cash_closures
set period_start_date = cash_date
where period_start_date is null;

create or replace function public.close_cash_day(
  p_machine_id uuid,
  p_cash_date date,
  p_counted_cash numeric,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status public.machine_status;
  v_previous_date date;
  v_opening_cash numeric(14,2) := 0;
  v_period_start date;
  v_sales numeric(14,2);
  v_collected numeric(14,2);
  v_reinforcement numeric(14,2);
  v_withdrawal numeric(14,2);
  v_expected numeric(14,2);
begin
  if auth.uid() is null or public.current_user_role() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para registar uma contagem de caixa.' using errcode = '42501';
  end if;
  if p_cash_date is null or p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Indique a data da contagem e um valor igual ou superior a zero.' using errcode = '22023';
  end if;

  select status into v_status from public.machines where id = p_machine_id for update;
  if not found or v_status <> 'active' then
    raise exception 'Máquina inexistente ou inativa.' using errcode = '22023';
  end if;
  if exists (select 1 from public.cash_closures where machine_id = p_machine_id and cash_date >= p_cash_date) then
    raise exception 'Registe a nova contagem depois da data da última contagem.' using errcode = '23505';
  end if;

  select cash_date, counted_cash into v_previous_date, v_opening_cash
  from public.cash_closures
  where machine_id = p_machine_id and cash_date < p_cash_date
  order by cash_date desc
  limit 1;

  if v_previous_date is null then
    select min(event_date) into v_period_start
    from (
      select sale_date as event_date from public.sales where machine_id = p_machine_id and status = 'confirmed'
      union all
      select operation_date as event_date from public.cash_operations where machine_id = p_machine_id
      union all
      select p_cash_date
    ) as machine_events;
  else
    v_period_start := v_previous_date + 1;
  end if;

  select coalesce(sum(total_inc_vat), 0) into v_sales
  from public.sales
  where machine_id = p_machine_id and sale_date between v_period_start and p_cash_date and status = 'confirmed';

  select
    coalesce(sum(amount) filter (where operation_type = 'collection'), 0),
    coalesce(sum(amount) filter (where operation_type = 'float_reinforcement'), 0),
    coalesce(sum(amount) filter (where operation_type = 'withdrawal'), 0)
  into v_collected, v_reinforcement, v_withdrawal
  from public.cash_operations
  where machine_id = p_machine_id and operation_date between v_period_start and p_cash_date;

  v_expected := coalesce(v_opening_cash, 0) + v_sales + v_reinforcement - v_withdrawal - v_collected;

  insert into public.cash_closures (
    machine_id, cash_date, period_start_date, sales_total, collected_total, reinforcement_total, withdrawal_total,
    expected_cash, counted_cash, difference, notes, created_by
  ) values (
    p_machine_id, p_cash_date, v_period_start, v_sales, v_collected, v_reinforcement, v_withdrawal,
    v_expected, round(p_counted_cash, 2), round(p_counted_cash, 2) - v_expected, coalesce(p_notes, ''), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.prevent_sales_in_counted_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.cash_closures
    where machine_id = new.machine_id and cash_date >= new.sale_date
  ) then
    raise exception 'A data da venda pertence a um período de caixa já contado.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger sales_not_in_counted_period
before insert on public.sales
for each row execute function public.prevent_sales_in_counted_period();

create or replace function public.prevent_cash_operations_in_counted_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.cash_closures
    where machine_id = new.machine_id and cash_date >= new.operation_date
  ) then
    raise exception 'A data do movimento pertence a um período de caixa já contado.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger cash_operations_not_in_counted_period
before insert on public.cash_operations
for each row execute function public.prevent_cash_operations_in_counted_period();

create or replace function public.mark_count_after_voided_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'confirmed' and new.status = 'voided' then
    update public.cash_closures
    set needs_review = true
    where id = (
      select id from public.cash_closures
      where machine_id = new.machine_id and cash_date >= new.sale_date
      order by cash_date asc
      limit 1
    );
  end if;
  return new;
end;
$$;

create trigger mark_cash_count_after_sale_void
after update of status on public.sales
for each row execute function public.mark_count_after_voided_sale();
