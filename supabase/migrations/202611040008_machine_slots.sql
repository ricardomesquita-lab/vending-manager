begin;

create table public.machine_slots (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id),
  selection_code text not null,
  product_id uuid references public.products(id),
  quantity integer not null default 0 check (quantity >= 0),
  capacity integer not null default 10 check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (machine_id, selection_code),
  check (quantity <= capacity)
);

alter table public.sale_lines
  add column machine_slot_id uuid references public.machine_slots(id);
alter table public.sale_lines
  drop constraint if exists sale_lines_sale_id_product_id_key;
create unique index sale_lines_sale_slot_unique
  on public.sale_lines (sale_id, machine_slot_id)
  where machine_slot_id is not null;

alter table public.replenishment_lines
  add column machine_slot_id uuid references public.machine_slots(id);

insert into public.machine_slots (machine_id, selection_code)
select m.id, slot.selection_code
from public.machines m
cross join (values
  ('11'), ('13'), ('15'), ('17'),
  ('21'), ('22'), ('23'), ('24'), ('25'), ('26'), ('27'),
  ('31'), ('33'), ('35'), ('37'),
  ('41'), ('43'), ('45'), ('47'),
  ('51'), ('52'), ('53'), ('54'), ('55'), ('56'), ('57'), ('58'),
  ('61'), ('62'), ('63'), ('64'), ('65'), ('66'), ('67'), ('68')
) as slot(selection_code)
where m.code = 'M2'
on conflict (machine_id, selection_code) do nothing;

alter table public.machine_slots enable row level security;
create policy "Authenticated users can read machine slots"
  on public.machine_slots for select to authenticated using (true);
create policy "Administrators can manage machine slots"
  on public.machine_slots for all to authenticated
  using ((select public.current_user_role()) = 'administrator')
  with check ((select public.current_user_role()) = 'administrator');
grant select, insert, update, delete on public.machine_slots to authenticated;

create function public.register_machine_slot_sale(
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
  v_existing_sale_id uuid;
  v_product_lines jsonb;
  v_line_count integer;
  v_slot_count integer;
  v_product_count integer;
begin
  if auth.uid() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para registar vendas.' using errcode = '42501';
  end if;
  if p_sale_date is null or p_request_key is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Indique a data e pelo menos uma posição para a venda.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));

  select count(*), count(distinct x.slot_id), count(distinct s.product_id)
    into v_line_count, v_slot_count, v_product_count
  from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
  left join public.machine_slots s on s.id = x.slot_id;
  if v_line_count = 0 or v_line_count <> v_slot_count or v_line_count <> v_product_count then
    raise exception 'Escolha posições diferentes e não repita o mesmo produto na venda.' using errcode = '22023';
  end if;

  select id into v_existing_sale_id from public.sales where request_key = p_request_key;
  if v_existing_sale_id is not null then
    if exists (
      select 1 from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
      join public.machine_slots s on s.id = x.slot_id
      left join public.sale_lines l on l.sale_id = v_existing_sale_id and l.product_id = s.product_id
      where l.machine_slot_id is distinct from x.slot_id or l.quantity is distinct from x.quantity
    ) then
      raise exception 'Esta chave de operação já foi usada com dados diferentes.' using errcode = '23505';
    end if;
    return v_existing_sale_id;
  end if;

  perform 1 from public.machine_slots s
  where s.id in (select x.slot_id from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer))
  order by s.selection_code for update;

  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
    join public.machine_slots s on s.id = x.slot_id
    where s.machine_id <> p_machine_id or s.product_id is null or not s.active
      or x.quantity is null or x.quantity <= 0 or s.quantity < x.quantity
  ) then
    raise exception 'Uma posição não tem produto ou stock suficiente.' using errcode = '23514';
  end if;

  select jsonb_agg(jsonb_build_object('product_id', s.product_id, 'quantity', x.quantity) order by s.product_id)
    into v_product_lines
  from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
  join public.machine_slots s on s.id = x.slot_id;

  v_sale_id := public.register_sale(p_machine_id, p_sale_date, v_product_lines, p_request_key);

  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
    join public.machine_slots s on s.id = x.slot_id
    join public.sale_lines l on l.sale_id = v_sale_id and l.product_id = s.product_id
    where l.machine_slot_id is not null and l.machine_slot_id <> s.id
  ) then
    raise exception 'A venda já está associada a outras posições.' using errcode = '23505';
  end if;

  update public.sale_lines l
    set machine_slot_id = s.id
  from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
  join public.machine_slots s on s.id = x.slot_id
  where l.sale_id = v_sale_id and l.product_id = s.product_id and l.machine_slot_id is null;

  update public.machine_slots s
    set quantity = s.quantity - x.quantity, updated_at = now()
  from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
  where s.id = x.slot_id;

  return v_sale_id;
end;
$$;

create function public.replenish_machine_slot(
  p_slot_id uuid,
  p_quantity integer,
  p_notes text,
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.machine_slots%rowtype;
  v_replenishment_id uuid;
  v_existing_id uuid;
  v_existing_slot_id uuid;
  v_existing_quantity integer;
begin
  if auth.uid() is null or public.current_user_role() not in ('administrator', 'operator') then
    raise exception 'É necessário iniciar sessão para repor máquinas.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_request_key is null then
    raise exception 'Indique uma quantidade válida.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  select id into v_existing_id from public.replenishments where request_key = p_request_key;
  if v_existing_id is not null then
    select machine_slot_id, quantity into v_existing_slot_id, v_existing_quantity
    from public.replenishment_lines where replenishment_id = v_existing_id;
    if v_existing_slot_id = p_slot_id and v_existing_quantity = p_quantity then
      return v_existing_id;
    end if;
    raise exception 'Esta chave de operação já foi usada com dados diferentes.' using errcode = '23505';
  end if;

  select * into v_slot from public.machine_slots where id = p_slot_id for update;
  if not found or v_slot.product_id is null or not v_slot.active then
    raise exception 'Esta posição ainda não tem um produto ativo.' using errcode = '22023';
  end if;
  if v_slot.quantity + p_quantity > v_slot.capacity then
    raise exception 'A quantidade ultrapassa a capacidade desta posição.' using errcode = '23514';
  end if;

  v_replenishment_id := public.replenish_machine(
    v_slot.machine_id,
    jsonb_build_array(jsonb_build_object('product_id', v_slot.product_id, 'quantity', p_quantity)),
    coalesce(p_notes, ''),
    p_request_key
  );

  select machine_slot_id, quantity into v_existing_slot_id, v_existing_quantity
  from public.replenishment_lines where replenishment_id = v_replenishment_id and product_id = v_slot.product_id;
  if v_existing_slot_id is not null then
    if v_existing_slot_id = p_slot_id and v_existing_quantity = p_quantity then
      return v_replenishment_id;
    end if;
    raise exception 'A reposição já foi associada a outra posição.' using errcode = '23505';
  end if;

  update public.replenishment_lines
    set machine_slot_id = p_slot_id
  where replenishment_id = v_replenishment_id and product_id = v_slot.product_id;
  update public.machine_slots
    set quantity = quantity + p_quantity, updated_at = now()
  where id = p_slot_id;
  return v_replenishment_id;
end;
$$;

create function public.restore_machine_slot_after_sale_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'confirmed' and new.status = 'voided' then
    update public.machine_slots s
      set quantity = s.quantity + l.quantity, updated_at = now()
    from public.sale_lines l
    where l.sale_id = new.id and l.machine_slot_id = s.id and s.product_id = l.product_id;
  end if;
  return new;
end;
$$;

create function public.protect_machine_slot_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_id is distinct from old.product_id then
    if old.quantity > 0
      or exists (select 1 from public.sale_lines where machine_slot_id = old.id)
      or exists (select 1 from public.replenishment_lines where machine_slot_id = old.id) then
      raise exception 'Uma posição com stock ou histórico não pode ser atribuída a outro produto.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_machine_slot_assignment
  before update of product_id on public.machine_slots
  for each row execute function public.protect_machine_slot_assignment();

create trigger restore_machine_slot_after_sale_void
  after update of status on public.sales
  for each row execute function public.restore_machine_slot_after_sale_void();

grant execute on function public.register_machine_slot_sale(uuid, date, jsonb, uuid) to authenticated;
grant execute on function public.replenish_machine_slot(uuid, integer, text, uuid) to authenticated;

commit;
