create type public.sale_status as enum ('confirmed', 'voided');
create type public.cash_operation_type as enum ('collection', 'float_reinforcement', 'withdrawal');

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  request_fingerprint text not null,
  machine_id uuid not null references public.machines(id),
  sale_date date not null,
  payment_method text not null default 'cash' check (payment_method = 'cash'),
  status public.sale_status not null default 'confirmed',
  total_ex_vat numeric(14,2) not null default 0 check (total_ex_vat >= 0),
  total_vat numeric(14,2) not null default 0 check (total_vat >= 0),
  total_inc_vat numeric(14,2) not null default 0 check (total_inc_vat >= 0),
  total_cost_ex_vat numeric(14,4) not null default 0 check (total_cost_ex_vat >= 0),
  gross_margin numeric(14,4) not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  voided_by uuid references auth.users(id),
  voided_at timestamptz,
  void_reason text,
  constraint sales_void_audit check (
    (status = 'confirmed' and voided_by is null and voided_at is null and void_reason is null) or
    (status = 'voided' and voided_by is not null and voided_at is not null and nullif(btrim(void_reason), '') is not null)
  )
);
create index sales_machine_date_status_idx on public.sales (machine_id, sale_date desc, status);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price_gross numeric(12,2) not null check (unit_price_gross >= 0),
  vat_rate numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  line_total_ex_vat numeric(14,2) not null check (line_total_ex_vat >= 0),
  line_vat numeric(14,2) not null check (line_vat >= 0),
  line_total_inc_vat numeric(14,2) not null check (line_total_inc_vat >= 0),
  unit_cost_ex_vat numeric(12,4) not null check (unit_cost_ex_vat >= 0),
  line_cost_ex_vat numeric(14,4) not null check (line_cost_ex_vat >= 0),
  line_margin numeric(14,4) not null,
  unique (sale_id, product_id)
);

create table public.cash_closures (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id),
  cash_date date not null,
  sales_total numeric(14,2) not null check (sales_total >= 0),
  collected_total numeric(14,2) not null check (collected_total >= 0),
  reinforcement_total numeric(14,2) not null check (reinforcement_total >= 0),
  withdrawal_total numeric(14,2) not null check (withdrawal_total >= 0),
  expected_cash numeric(14,2) not null,
  counted_cash numeric(14,2) not null check (counted_cash >= 0),
  difference numeric(14,2) not null,
  notes text not null default '',
  needs_review boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (machine_id, cash_date)
);

create function public.register_sale(
  p_machine_id uuid,
  p_sale_date date,
  p_lines jsonb,
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_existing_fingerprint text;
  v_fingerprint text;
  v_machine_status public.machine_status;
  v_line record;
  v_product_name text;
  v_unit_price_gross numeric(12,2);
  v_vat_rate numeric(5,2);
  v_unit_cost numeric(12,4);
  v_available integer;
  v_line_gross numeric(14,2);
  v_line_ex numeric(14,2);
  v_line_vat numeric(14,2);
  v_line_cost numeric(14,4);
  v_total_ex numeric(14,2) := 0;
  v_total_vat numeric(14,2) := 0;
  v_total_gross numeric(14,2) := 0;
  v_total_cost numeric(14,4) := 0;
  v_count integer;
  v_distinct_count integer;
begin
  if auth.uid() is null or public.current_user_role() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para registar vendas.' using errcode = '42501';
  end if;
  if p_request_key is null or p_sale_date is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A venda precisa de máquina, data e pelo menos um produto.' using errcode = '22023';
  end if;
  select count(*), count(distinct x.product_id)
    into v_count, v_distinct_count
    from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity integer);
  if v_count = 0 or v_count <> v_distinct_count then
    raise exception 'A lista de produtos está vazia ou contém produtos repetidos.' using errcode = '22023';
  end if;
  v_fingerprint := p_machine_id::text || '|' || p_sale_date::text || '|' || p_lines::text;

  select status into v_machine_status from public.machines where id = p_machine_id for update;
  if not found or v_machine_status <> 'active' then
    raise exception 'Máquina inexistente ou inativa.' using errcode = '22023';
  end if;
  if exists (select 1 from public.cash_closures where machine_id = p_machine_id and cash_date = p_sale_date) then
    raise exception 'O caixa desse dia já foi fechado.' using errcode = '55000';
  end if;

  insert into public.sales (request_key, request_fingerprint, machine_id, sale_date, created_by)
  values (p_request_key, v_fingerprint, p_machine_id, p_sale_date, auth.uid())
  on conflict (request_key) do nothing
  returning id into v_sale_id;
  if v_sale_id is null then
    select id, request_fingerprint into v_sale_id, v_existing_fingerprint from public.sales where request_key = p_request_key;
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'A chave da operação já foi usada com dados diferentes.' using errcode = '23505';
    end if;
    return v_sale_id;
  end if;

  for v_line in
    select * from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity integer)
    order by x.product_id
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'As quantidades vendidas devem ser superiores a zero.' using errcode = '22023';
    end if;
    select name, sale_price_gross, vat_rate, average_cost_ex_vat
      into v_product_name, v_unit_price_gross, v_vat_rate, v_unit_cost
      from public.products where id = v_line.product_id and active for update;
    if not found then
      raise exception 'Produto inexistente ou inativo: %', v_line.product_id using errcode = '22023';
    end if;
    select sale_price_gross into v_unit_price_gross from public.machine_product_prices
      where machine_id = p_machine_id and product_id = v_line.product_id;
    if not found then
      select sale_price_gross into v_unit_price_gross from public.products where id = v_line.product_id;
    end if;
    select quantity into v_available from public.machine_stock
      where machine_id = p_machine_id and product_id = v_line.product_id for update;
    if not found or v_available < v_line.quantity then
      raise exception 'Stock insuficiente na máquina para %.', v_product_name using errcode = '23514';
    end if;

    v_line_gross := round(v_line.quantity * v_unit_price_gross, 2);
    v_line_ex := round(v_line_gross / (1 + v_vat_rate / 100), 2);
    v_line_vat := v_line_gross - v_line_ex;
    v_line_cost := round(v_line.quantity * v_unit_cost, 4);
    insert into public.sale_lines (
      sale_id, product_id, quantity, unit_price_gross, vat_rate,
      line_total_ex_vat, line_vat, line_total_inc_vat,
      unit_cost_ex_vat, line_cost_ex_vat, line_margin
    ) values (
      v_sale_id, v_line.product_id, v_line.quantity, v_unit_price_gross, v_vat_rate,
      v_line_ex, v_line_vat, v_line_gross, v_unit_cost, v_line_cost, v_line_ex - v_line_cost
    );
    update public.machine_stock set quantity = quantity - v_line.quantity, updated_at = now()
    where machine_id = p_machine_id and product_id = v_line.product_id;
    insert into public.stock_movements (
      movement_type, location, machine_id, product_id, quantity_delta,
      unit_cost_ex_vat, reference_id, created_by
    ) values (
      'sale_out', 'machine', p_machine_id, v_line.product_id, -v_line.quantity,
      v_unit_cost, v_sale_id, auth.uid()
    );
    v_total_ex := v_total_ex + v_line_ex;
    v_total_vat := v_total_vat + v_line_vat;
    v_total_gross := v_total_gross + v_line_gross;
    v_total_cost := v_total_cost + v_line_cost;
  end loop;

  update public.sales set
    total_ex_vat = v_total_ex,
    total_vat = v_total_vat,
    total_inc_vat = v_total_gross,
    total_cost_ex_vat = v_total_cost,
    gross_margin = v_total_ex - v_total_cost
  where id = v_sale_id;
  return v_sale_id;
end;
$$;

create function public.void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_line record;
  v_cost numeric(12,4);
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'administrator' then
    raise exception 'Apenas um administrador pode anular vendas.' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A justificação da anulação é obrigatória.' using errcode = '22023';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.status <> 'confirmed' then
    raise exception 'A venda não existe ou já foi anulada.' using errcode = '22023';
  end if;
  perform 1 from public.machines where id = v_sale.machine_id for update;
  for v_line in select product_id, quantity, unit_cost_ex_vat from public.sale_lines where sale_id = p_sale_id order by product_id
  loop
    v_cost := v_line.unit_cost_ex_vat;
    insert into public.machine_stock (machine_id, product_id, quantity)
    values (v_sale.machine_id, v_line.product_id, v_line.quantity)
    on conflict (machine_id, product_id) do update
      set quantity = machine_stock.quantity + excluded.quantity, updated_at = now();
    insert into public.stock_movements (
      movement_type, location, machine_id, product_id, quantity_delta,
      unit_cost_ex_vat, reference_id, reason, created_by
    ) values (
      'sale_reversal_in', 'machine', v_sale.machine_id, v_line.product_id, v_line.quantity,
      v_cost, p_sale_id, btrim(p_reason), auth.uid()
    );
  end loop;
  update public.sales set status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = btrim(p_reason)
  where id = p_sale_id;
  update public.cash_closures set needs_review = true
  where machine_id = v_sale.machine_id and cash_date = v_sale.sale_date;
end;
$$;

create table public.cash_operations (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  request_fingerprint text not null,
  machine_id uuid not null references public.machines(id),
  operation_date date not null,
  operation_type public.cash_operation_type not null,
  amount numeric(12,2) not null check (amount > 0),
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index cash_operations_machine_date_idx on public.cash_operations (machine_id, operation_date desc);

create function public.record_cash_operation(
  p_machine_id uuid,
  p_operation_date date,
  p_operation_type public.cash_operation_type,
  p_amount numeric,
  p_notes text,
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status public.machine_status;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if auth.uid() is null or public.current_user_role() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para registar operações de caixa.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_operation_date is null or p_request_key is null then
    raise exception 'A operação de caixa precisa de data e valor superior a zero.' using errcode = '22023';
  end if;
  select status into v_status from public.machines where id = p_machine_id for update;
  if not found or v_status <> 'active' then
    raise exception 'Máquina inexistente ou inativa.' using errcode = '22023';
  end if;
  if exists (select 1 from public.cash_closures where machine_id = p_machine_id and cash_date = p_operation_date) then
    raise exception 'O caixa desse dia já foi fechado.' using errcode = '55000';
  end if;
  v_fingerprint := p_machine_id::text || '|' || p_operation_date::text || '|' || p_operation_type::text || '|' || round(p_amount, 2)::text || '|' || coalesce(p_notes, '');
  insert into public.cash_operations (request_key, request_fingerprint, machine_id, operation_date, operation_type, amount, notes, created_by)
  values (p_request_key, v_fingerprint, p_machine_id, p_operation_date, p_operation_type, round(p_amount, 2), coalesce(p_notes, ''), auth.uid())
  on conflict (request_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id, request_fingerprint into v_id, v_existing_fingerprint from public.cash_operations where request_key = p_request_key;
    if v_existing_fingerprint <> v_fingerprint then
      raise exception 'A chave da operação já foi usada com dados diferentes.' using errcode = '23505';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.close_cash_day(
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
  v_sales numeric(14,2);
  v_collected numeric(14,2);
  v_reinforcement numeric(14,2);
  v_withdrawal numeric(14,2);
  v_expected numeric(14,2);
begin
  if auth.uid() is null or public.current_user_role() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para fechar caixa.' using errcode = '42501';
  end if;
  if p_cash_date is null or p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Indique a data e um valor contado igual ou superior a zero.' using errcode = '22023';
  end if;
  select status into v_status from public.machines where id = p_machine_id for update;
  if not found or v_status <> 'active' then
    raise exception 'Máquina inexistente ou inativa.' using errcode = '22023';
  end if;
  if exists (select 1 from public.cash_closures where machine_id = p_machine_id and cash_date = p_cash_date) then
    raise exception 'O caixa desta máquina já foi fechado nessa data.' using errcode = '23505';
  end if;

  select coalesce(sum(total_inc_vat), 0) into v_sales
  from public.sales where machine_id = p_machine_id and sale_date = p_cash_date and status = 'confirmed';
  select
    coalesce(sum(amount) filter (where operation_type = 'collection'), 0),
    coalesce(sum(amount) filter (where operation_type = 'float_reinforcement'), 0),
    coalesce(sum(amount) filter (where operation_type = 'withdrawal'), 0)
    into v_collected, v_reinforcement, v_withdrawal
  from public.cash_operations where machine_id = p_machine_id and operation_date = p_cash_date;
  v_expected := v_sales + v_reinforcement - v_withdrawal - v_collected;
  insert into public.cash_closures (
    machine_id, cash_date, sales_total, collected_total, reinforcement_total, withdrawal_total,
    expected_cash, counted_cash, difference, notes, created_by
  ) values (
    p_machine_id, p_cash_date, v_sales, v_collected, v_reinforcement, v_withdrawal,
    v_expected, round(p_counted_cash, 2), round(p_counted_cash, 2) - v_expected, coalesce(p_notes, ''), auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.cash_operations enable row level security;
alter table public.cash_closures enable row level security;

create policy "Authenticated users can read sales" on public.sales for select to authenticated using (true);
create policy "Authenticated users can read sale lines" on public.sale_lines for select to authenticated using (true);
create policy "Authenticated users can read cash operations" on public.cash_operations for select to authenticated using (true);
create policy "Authenticated users can read cash closures" on public.cash_closures for select to authenticated using (true);

grant select on public.sales, public.sale_lines, public.cash_operations, public.cash_closures to authenticated;
grant execute on function public.register_sale(uuid, date, jsonb, uuid) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.record_cash_operation(uuid, date, public.cash_operation_type, numeric, text, uuid) to authenticated;
grant execute on function public.close_cash_day(uuid, date, numeric, text) to authenticated;
