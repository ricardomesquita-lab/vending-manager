create type public.stock_location as enum ('warehouse', 'machine');
create type public.stock_movement_type as enum (
  'purchase_in', 'replenishment_out', 'replenishment_in', 'inventory_adjustment'
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  contacts text not null default '',
  address text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_tax_id_unique unique (tax_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  internal_code text not null unique,
  barcode text unique,
  name text not null,
  category_id uuid not null references public.product_categories(id),
  description text not null default '',
  preferred_supplier_id uuid references public.suppliers(id),
  average_cost_ex_vat numeric(12,4) not null default 0 check (average_cost_ex_vat >= 0),
  vat_rate numeric(5,2) not null default 23 check (vat_rate >= 0 and vat_rate <= 100),
  sale_price_gross numeric(12,2) not null check (sale_price_gross >= 0),
  warehouse_minimum integer not null default 0 check (warehouse_minimum >= 0),
  machine_minimum integer not null default 0 check (machine_minimum >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.machine_product_prices (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id),
  product_id uuid not null references public.products(id),
  sale_price_gross numeric(12,2) not null check (sale_price_gross >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (machine_id, product_id)
);

create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  machine_id uuid references public.machines(id),
  sale_price_gross numeric(12,2) not null check (sale_price_gross >= 0),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create function public.record_product_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'products' then
    insert into public.product_price_history (product_id, sale_price_gross, changed_by)
    values (new.id, new.sale_price_gross, auth.uid());
  else
    insert into public.product_price_history (product_id, machine_id, sale_price_gross, changed_by)
    values (new.product_id, new.machine_id, new.sale_price_gross, auth.uid());
  end if;
  return new;
end;
$$;

create trigger products_price_history
  after insert or update of sale_price_gross on public.products
  for each row execute procedure public.record_product_price_history();
create trigger machine_prices_history
  after insert or update of sale_price_gross on public.machine_product_prices
  for each row execute procedure public.record_product_price_history();

create table public.warehouse_stock (
  product_id uuid primary key references public.products(id),
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

create table public.machine_stock (
  machine_id uuid not null references public.machines(id),
  product_id uuid not null references public.products(id),
  quantity integer not null default 0 check (quantity >= 0),
  capacity integer check (capacity is null or capacity >= 0),
  updated_at timestamptz not null default now(),
  primary key (machine_id, product_id),
  constraint machine_stock_within_capacity check (capacity is null or quantity <= capacity)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type public.stock_movement_type not null,
  location public.stock_location not null,
  machine_id uuid references public.machines(id),
  product_id uuid not null references public.products(id),
  quantity_delta integer not null check (quantity_delta <> 0),
  unit_cost_ex_vat numeric(12,4) not null default 0 check (unit_cost_ex_vat >= 0),
  reference_id uuid not null,
  reason text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint stock_movement_location_machine check (
    (location = 'warehouse' and machine_id is null) or
    (location = 'machine' and machine_id is not null)
  )
);
create index stock_movements_product_created_at_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_machine_created_at_idx on public.stock_movements (machine_id, created_at desc) where machine_id is not null;

create type public.purchase_status as enum ('confirmed', 'cancelled');

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  invoice_number text not null,
  purchase_date date not null,
  status public.purchase_status not null default 'confirmed',
  total_ex_vat numeric(14,2) not null default 0 check (total_ex_vat >= 0),
  total_vat numeric(14,2) not null default 0 check (total_vat >= 0),
  total_inc_vat numeric(14,2) not null default 0 check (total_inc_vat >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (supplier_id, invoice_number)
);

create table public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id),
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_cost_ex_vat numeric(12,4) not null check (unit_cost_ex_vat >= 0),
  vat_rate numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  line_total_ex_vat numeric(14,4) not null check (line_total_ex_vat >= 0),
  line_vat numeric(14,4) not null check (line_vat >= 0),
  line_total_inc_vat numeric(14,4) not null check (line_total_inc_vat >= 0)
);

create function public.register_purchase(
  p_supplier_id uuid,
  p_invoice_number text,
  p_purchase_date date,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_line record;
  v_previous_quantity integer;
  v_previous_cost numeric(12,4);
  v_line_ex numeric(14,4);
  v_line_vat numeric(14,4);
  v_total_ex numeric(14,4) := 0;
  v_total_vat numeric(14,4) := 0;
  v_total_inc numeric(14,4) := 0;
  v_count integer;
  v_distinct_count integer;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'administrator' then
    raise exception 'Apenas administradores podem registar compras.' using errcode = '42501';
  end if;
  if nullif(btrim(p_invoice_number), '') is null or p_purchase_date is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A compra precisa de fatura, data e pelo menos uma linha.' using errcode = '22023';
  end if;

  select count(*), count(distinct x.product_id)
    into v_count, v_distinct_count
    from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity integer, unit_cost_ex_vat numeric, vat_rate numeric, discount_percent numeric);
  if v_count = 0 or v_count <> v_distinct_count then
    raise exception 'A lista de produtos está vazia ou contém produtos repetidos.' using errcode = '22023';
  end if;

  insert into public.purchases (supplier_id, invoice_number, purchase_date, created_by)
  values (p_supplier_id, btrim(p_invoice_number), p_purchase_date, auth.uid())
  returning id into v_purchase_id;

  for v_line in
    select * from jsonb_to_recordset(p_lines) as x(
      product_id uuid, quantity integer, unit_cost_ex_vat numeric, vat_rate numeric, discount_percent numeric
    )
    order by x.product_id
  loop
    if v_line.quantity is null or v_line.quantity <= 0 or v_line.unit_cost_ex_vat is null or v_line.unit_cost_ex_vat < 0
      or v_line.vat_rate is null or v_line.vat_rate < 0 or v_line.vat_rate > 100
      or coalesce(v_line.discount_percent, 0) < 0 or coalesce(v_line.discount_percent, 0) > 100 then
      raise exception 'Uma linha da compra tem quantidade, custo, IVA ou desconto inválido.' using errcode = '22023';
    end if;

    v_line_ex := round(v_line.quantity * v_line.unit_cost_ex_vat * (1 - coalesce(v_line.discount_percent, 0) / 100), 4);
    v_line_vat := round(v_line_ex * v_line.vat_rate / 100, 4);
    insert into public.purchase_lines (
      purchase_id, product_id, quantity, unit_cost_ex_vat, vat_rate, discount_percent,
      line_total_ex_vat, line_vat, line_total_inc_vat
    ) values (
      v_purchase_id, v_line.product_id, v_line.quantity, v_line.unit_cost_ex_vat,
      v_line.vat_rate, coalesce(v_line.discount_percent, 0), v_line_ex, v_line_vat, v_line_ex + v_line_vat
    );
    v_total_ex := v_total_ex + v_line_ex;
    v_total_vat := v_total_vat + v_line_vat;
    v_total_inc := v_total_inc + v_line_ex + v_line_vat;

    insert into public.warehouse_stock (product_id, quantity) values (v_line.product_id, 0)
    on conflict (product_id) do nothing;
    select quantity into v_previous_quantity from public.warehouse_stock where product_id = v_line.product_id for update;
    select average_cost_ex_vat into v_previous_cost from public.products where id = v_line.product_id and active for update;
    if not found then
      raise exception 'Produto inexistente ou inativo: %', v_line.product_id using errcode = '22023';
    end if;

    update public.warehouse_stock
      set quantity = quantity + v_line.quantity, updated_at = now()
      where product_id = v_line.product_id;
    update public.products
      set average_cost_ex_vat = case
        when v_previous_quantity + v_line.quantity = 0 then 0
        else round(((v_previous_quantity * v_previous_cost) + v_line_ex) / (v_previous_quantity + v_line.quantity), 4)
      end,
      updated_at = now()
      where id = v_line.product_id;
    insert into public.stock_movements (
      movement_type, location, product_id, quantity_delta, unit_cost_ex_vat, reference_id, created_by
    ) values ('purchase_in', 'warehouse', v_line.product_id, v_line.quantity, v_line_ex / v_line.quantity, v_purchase_id, auth.uid());
  end loop;

  update public.purchases set
    total_ex_vat = round(v_total_ex, 2),
    total_vat = round(v_total_vat, 2),
    total_inc_vat = round(v_total_inc, 2)
  where id = v_purchase_id;
  return v_purchase_id;
end;
$$;

create table public.replenishments (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  machine_id uuid not null references public.machines(id),
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.replenishment_lines (
  id uuid primary key default gen_random_uuid(),
  replenishment_id uuid not null references public.replenishments(id),
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unique (replenishment_id, product_id)
);

create function public.replenish_machine(p_machine_id uuid, p_lines jsonb, p_notes text, p_request_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replenishment_id uuid;
  v_line record;
  v_count integer;
  v_distinct_count integer;
  v_available integer;
  v_cost numeric(12,4);
begin
  if auth.uid() is null or public.current_user_role() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para repor máquinas.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A reposição precisa de pelo menos um produto.' using errcode = '22023';
  end if;
  if p_request_key is null then
    raise exception 'A chave de operação é obrigatória.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.machines where id = p_machine_id and status = 'active') then
    raise exception 'Máquina inexistente ou inativa.' using errcode = '22023';
  end if;
  select count(*), count(distinct x.product_id)
    into v_count, v_distinct_count
    from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity integer);
  if v_count = 0 or v_count <> v_distinct_count then
    raise exception 'A lista de produtos está vazia ou contém produtos repetidos.' using errcode = '22023';
  end if;

  insert into public.replenishments (request_key, machine_id, notes, created_by)
  values (p_request_key, p_machine_id, coalesce(p_notes, ''), auth.uid())
  on conflict (request_key) do nothing
  returning id into v_replenishment_id;
  if v_replenishment_id is null then
    select id into v_replenishment_id from public.replenishments where request_key = p_request_key;
    return v_replenishment_id;
  end if;

  for v_line in select * from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity integer) order by x.product_id
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'As quantidades de reposição devem ser superiores a zero.' using errcode = '22023';
    end if;
    insert into public.warehouse_stock (product_id, quantity) values (v_line.product_id, 0)
    on conflict (product_id) do nothing;
    select quantity into v_available from public.warehouse_stock where product_id = v_line.product_id for update;
    if not found or v_available < v_line.quantity then
      raise exception 'Stock de armazém insuficiente para o produto %.', v_line.product_id using errcode = '23514';
    end if;
    select average_cost_ex_vat into v_cost from public.products where id = v_line.product_id and active for update;
    if not found then
      raise exception 'Produto inexistente ou inativo: %', v_line.product_id using errcode = '22023';
    end if;
    update public.warehouse_stock set quantity = quantity - v_line.quantity, updated_at = now() where product_id = v_line.product_id;
    insert into public.machine_stock (machine_id, product_id, quantity)
    values (p_machine_id, v_line.product_id, v_line.quantity)
    on conflict (machine_id, product_id) do update
      set quantity = machine_stock.quantity + excluded.quantity, updated_at = now();
    insert into public.replenishment_lines (replenishment_id, product_id, quantity)
    values (v_replenishment_id, v_line.product_id, v_line.quantity);
    insert into public.stock_movements (movement_type, location, machine_id, product_id, quantity_delta, unit_cost_ex_vat, reference_id, created_by)
    values
      ('replenishment_out', 'warehouse', null, v_line.product_id, -v_line.quantity, v_cost, v_replenishment_id, auth.uid()),
      ('replenishment_in', 'machine', p_machine_id, v_line.product_id, v_line.quantity, v_cost, v_replenishment_id, auth.uid());
  end loop;
  return v_replenishment_id;
end;
$$;

create type public.inventory_scope as enum ('warehouse', 'machine');
create type public.inventory_count_status as enum ('pending_approval', 'confirmed');
create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  scope public.inventory_scope not null,
  machine_id uuid references public.machines(id),
  justification text not null,
  status public.inventory_count_status not null default 'pending_approval',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  constraint inventory_scope_machine check (
    (scope = 'warehouse' and machine_id is null) or (scope = 'machine' and machine_id is not null)
  )
);
create table public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  inventory_count_id uuid not null references public.inventory_counts(id),
  product_id uuid not null references public.products(id),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_counted integer not null check (quantity_counted >= 0),
  quantity_difference integer generated always as (quantity_counted - quantity_before) stored,
  unique (inventory_count_id, product_id)
);

create function public.record_inventory_count(
  p_scope public.inventory_scope,
  p_machine_id uuid,
  p_justification text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count_id uuid;
  v_line record;
  v_before integer;
  v_count integer;
  v_distinct_count integer;
begin
  if auth.uid() is null or public.current_user_role() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para registar um inventário.' using errcode = '42501';
  end if;
  if nullif(btrim(p_justification), '') is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'O inventário precisa de justificação e pelo menos um produto.' using errcode = '22023';
  end if;
  if (p_scope = 'machine' and not exists (select 1 from public.machines where id = p_machine_id))
    or (p_scope = 'warehouse' and p_machine_id is not null) then
    raise exception 'Local de inventário inválido.' using errcode = '22023';
  end if;
  select count(*), count(distinct x.product_id)
    into v_count, v_distinct_count
    from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity_counted integer);
  if v_count = 0 or v_count <> v_distinct_count then
    raise exception 'A lista de produtos está vazia ou contém produtos repetidos.' using errcode = '22023';
  end if;

  insert into public.inventory_counts (scope, machine_id, justification, created_by)
  values (p_scope, p_machine_id, btrim(p_justification), auth.uid())
  returning id into v_count_id;

  for v_line in select * from jsonb_to_recordset(p_lines) as x(product_id uuid, quantity_counted integer) order by x.product_id
  loop
    if v_line.quantity_counted is null or v_line.quantity_counted < 0 then
      raise exception 'A quantidade contada não pode ser negativa.' using errcode = '22023';
    end if;
    if p_scope = 'warehouse' then
      insert into public.warehouse_stock (product_id, quantity) values (v_line.product_id, 0) on conflict (product_id) do nothing;
      select quantity into v_before from public.warehouse_stock where product_id = v_line.product_id for update;
    else
      insert into public.machine_stock (machine_id, product_id, quantity) values (p_machine_id, v_line.product_id, 0) on conflict do nothing;
      select quantity into v_before from public.machine_stock where machine_id = p_machine_id and product_id = v_line.product_id for update;
    end if;
    if not found then
      raise exception 'Produto ou stock inexistente: %', v_line.product_id using errcode = '22023';
    end if;
    insert into public.inventory_count_lines (inventory_count_id, product_id, quantity_before, quantity_counted)
    values (v_count_id, v_line.product_id, v_before, v_line.quantity_counted);
  end loop;
  return v_count_id;
end;
$$;

create function public.approve_inventory_count(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.inventory_counts%rowtype;
  v_line record;
  v_current integer;
  v_difference integer;
  v_cost numeric(12,4);
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'administrator' then
    raise exception 'Apenas um administrador pode autorizar correções de inventário.' using errcode = '42501';
  end if;
  select * into v_count from public.inventory_counts where id = p_count_id for update;
  if not found or v_count.status <> 'pending_approval' then
    raise exception 'O inventário não existe ou já foi confirmado.' using errcode = '22023';
  end if;

  for v_line in
    select product_id, quantity_before, quantity_counted
    from public.inventory_count_lines where inventory_count_id = p_count_id order by product_id
  loop
    if v_count.scope = 'warehouse' then
      select quantity into v_current from public.warehouse_stock where product_id = v_line.product_id for update;
    else
      select quantity into v_current from public.machine_stock
      where machine_id = v_count.machine_id and product_id = v_line.product_id for update;
    end if;
    if not found or v_current <> v_line.quantity_before then
      raise exception 'O stock mudou desde a contagem. Faça nova contagem do produto %.', v_line.product_id using errcode = '40001';
    end if;

    v_difference := v_line.quantity_counted - v_current;
    if v_difference <> 0 then
      if v_count.scope = 'warehouse' then
        update public.warehouse_stock set quantity = v_line.quantity_counted, updated_at = now() where product_id = v_line.product_id;
      else
        update public.machine_stock set quantity = v_line.quantity_counted, updated_at = now()
        where machine_id = v_count.machine_id and product_id = v_line.product_id;
      end if;
      select average_cost_ex_vat into v_cost from public.products where id = v_line.product_id;
      insert into public.stock_movements (movement_type, location, machine_id, product_id, quantity_delta, unit_cost_ex_vat, reference_id, reason, created_by)
      values ('inventory_adjustment', v_count.scope::text::public.stock_location, v_count.machine_id, v_line.product_id, v_difference, v_cost, p_count_id, v_count.justification, auth.uid());
    end if;
  end loop;

  update public.inventory_counts set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_count_id;
end;
$$;

alter table public.product_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.machine_product_prices enable row level security;
alter table public.product_price_history enable row level security;
alter table public.warehouse_stock enable row level security;
alter table public.machine_stock enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_lines enable row level security;
alter table public.replenishments enable row level security;
alter table public.replenishment_lines enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.inventory_count_lines enable row level security;

create policy "Authenticated users can read categories" on public.product_categories for select to authenticated using (true);
create policy "Administrators can manage categories" on public.product_categories for all to authenticated
  using ((select public.current_user_role()) = 'administrator') with check ((select public.current_user_role()) = 'administrator');
create policy "Authenticated users can read suppliers" on public.suppliers for select to authenticated using (true);
create policy "Administrators can manage suppliers" on public.suppliers for all to authenticated
  using ((select public.current_user_role()) = 'administrator') with check ((select public.current_user_role()) = 'administrator');
create policy "Authenticated users can read products" on public.products for select to authenticated using (true);
create policy "Administrators can manage products" on public.products for all to authenticated
  using ((select public.current_user_role()) = 'administrator') with check ((select public.current_user_role()) = 'administrator');
create policy "Authenticated users can read machine prices" on public.machine_product_prices for select to authenticated using (true);
create policy "Administrators can manage machine prices" on public.machine_product_prices for all to authenticated
  using ((select public.current_user_role()) = 'administrator') with check ((select public.current_user_role()) = 'administrator');
create policy "Authenticated users can read price history" on public.product_price_history for select to authenticated using (true);
create policy "Authenticated users can read warehouse stock" on public.warehouse_stock for select to authenticated using (true);
create policy "Authenticated users can read machine stock" on public.machine_stock for select to authenticated using (true);
create policy "Authenticated users can read stock movements" on public.stock_movements for select to authenticated using (true);
create policy "Administrators can read purchases" on public.purchases for select to authenticated
  using ((select public.current_user_role()) = 'administrator');
create policy "Administrators can read purchase lines" on public.purchase_lines for select to authenticated
  using ((select public.current_user_role()) = 'administrator');
create policy "Authenticated users can read replenishments" on public.replenishments for select to authenticated using (true);
create policy "Authenticated users can read replenishment lines" on public.replenishment_lines for select to authenticated using (true);
create policy "Authenticated users can read inventory counts" on public.inventory_counts for select to authenticated using (true);
create policy "Authenticated users can read inventory count lines" on public.inventory_count_lines for select to authenticated using (true);

grant select on public.product_categories, public.suppliers, public.products, public.machine_product_prices,
  public.product_price_history, public.warehouse_stock, public.machine_stock, public.stock_movements,
  public.replenishments, public.replenishment_lines, public.inventory_counts, public.inventory_count_lines to authenticated;
grant select on public.purchases, public.purchase_lines to authenticated;
grant insert, update, delete on public.product_categories, public.suppliers, public.products, public.machine_product_prices to authenticated;
grant execute on function public.register_purchase(uuid, text, date, jsonb) to authenticated;
grant execute on function public.replenish_machine(uuid, jsonb, text, uuid) to authenticated;
grant execute on function public.record_inventory_count(public.inventory_scope, uuid, text, jsonb) to authenticated;
grant execute on function public.approve_inventory_count(uuid) to authenticated;

insert into public.product_categories (name) values
  ('Águas'), ('Refrigerantes'), ('Sumos'), ('Café e bebidas quentes'),
  ('Snacks salgados'), ('Chocolates'), ('Bolachas'), ('Outros')
on conflict (name) do nothing;
