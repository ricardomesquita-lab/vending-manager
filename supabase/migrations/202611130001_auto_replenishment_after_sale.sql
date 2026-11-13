begin;

create table public.sale_auto_replenishments (
  sale_id uuid primary key references public.sales(id),
  replenishment_id uuid not null unique references public.replenishments(id),
  created_at timestamptz not null default now()
);

alter table public.sale_auto_replenishments enable row level security;

create function public.register_machine_slot_sale_and_replenish(
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
  v_replenishment_id uuid;
  v_existing_replenishment_id uuid;
  v_product_lines jsonb;
begin
  v_sale_id := public.register_machine_slot_sale(p_machine_id, p_sale_date, p_lines, p_request_key);

  select id into v_existing_replenishment_id
  from public.replenishments
  where request_key = p_request_key;
  if v_existing_replenishment_id is not null then
    if not exists (
      select 1 from public.sale_auto_replenishments
      where sale_id = v_sale_id and replenishment_id = v_existing_replenishment_id
    ) then
      raise exception 'A reposição já existe e não está associada a esta venda.' using errcode = '23505';
    end if;
    return v_sale_id;
  end if;

  select jsonb_agg(jsonb_build_object('product_id', s.product_id, 'quantity', x.quantity) order by s.product_id)
    into v_product_lines
  from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
  join public.machine_slots s on s.id = x.slot_id;

  v_replenishment_id := public.replenish_machine(
    p_machine_id,
    v_product_lines,
    'Reposição automática após venda',
    p_request_key
  );

  update public.replenishment_lines line
    set machine_slot_id = slot.id
  from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
  join public.machine_slots slot on slot.id = x.slot_id
  where line.replenishment_id = v_replenishment_id
    and line.product_id = slot.product_id;

  update public.machine_slots slot
    set quantity = slot.quantity + x.quantity,
        updated_at = now()
  from jsonb_to_recordset(p_lines) as x(slot_id uuid, quantity integer)
  where slot.id = x.slot_id;

  insert into public.sale_auto_replenishments (sale_id, replenishment_id)
  values (v_sale_id, v_replenishment_id);

  return v_sale_id;
end;
$$;

create or replace function public.restore_machine_slot_after_sale_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'confirmed' and new.status = 'voided'
    and not exists (select 1 from public.sale_auto_replenishments where sale_id = new.id) then
    update public.machine_slots s
      set quantity = s.quantity + l.quantity, updated_at = now()
    from public.sale_lines l
    where l.sale_id = new.id and l.machine_slot_id = s.id and s.product_id = l.product_id;
  end if;
  return new;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_line record;
  v_replenishment_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'administrator' then
    raise exception 'Apenas administradores podem anular vendas.' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A justificação da anulação é obrigatória.' using errcode = '22023';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.status <> 'confirmed' then
    raise exception 'A venda não existe ou já foi anulada.' using errcode = '22023';
  end if;
  perform 1 from public.machines where id = v_sale.machine_id for update;
  select replenishment_id into v_replenishment_id
  from public.sale_auto_replenishments where sale_id = p_sale_id;

  for v_line in
    select product_id, quantity, unit_cost_ex_vat
    from public.sale_lines where sale_id = p_sale_id order by product_id
  loop
    if v_replenishment_id is null then
      insert into public.machine_stock (machine_id, product_id, quantity)
      values (v_sale.machine_id, v_line.product_id, v_line.quantity)
      on conflict (machine_id, product_id) do update
        set quantity = machine_stock.quantity + excluded.quantity, updated_at = now();
      insert into public.stock_movements (
        movement_type, location, machine_id, product_id, quantity_delta,
        unit_cost_ex_vat, reference_id, reason, created_by
      ) values (
        'sale_reversal_in', 'machine', v_sale.machine_id, v_line.product_id, v_line.quantity,
        v_line.unit_cost_ex_vat, p_sale_id, btrim(p_reason), auth.uid()
      );
    else
      update public.warehouse_stock
        set quantity = quantity + v_line.quantity, updated_at = now()
        where product_id = v_line.product_id;
      insert into public.stock_movements (
        movement_type, location, machine_id, product_id, quantity_delta,
        unit_cost_ex_vat, reference_id, reason, created_by
      ) values
        ('sale_reversal_in', 'machine', v_sale.machine_id, v_line.product_id, v_line.quantity,
         v_line.unit_cost_ex_vat, p_sale_id, btrim(p_reason), auth.uid()),
        ('replenishment_out', 'machine', v_sale.machine_id, v_line.product_id, -v_line.quantity,
         v_line.unit_cost_ex_vat, v_replenishment_id, btrim(p_reason), auth.uid()),
        ('replenishment_in', 'warehouse', null, v_line.product_id, v_line.quantity,
         v_line.unit_cost_ex_vat, v_replenishment_id, btrim(p_reason), auth.uid());
    end if;
  end loop;
  update public.sales
    set status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = btrim(p_reason)
    where id = p_sale_id;
  update public.cash_closures set needs_review = true
    where machine_id = v_sale.machine_id and cash_date = v_sale.sale_date;
end;
$$;

grant execute on function public.register_machine_slot_sale_and_replenish(uuid, date, jsonb, uuid) to authenticated;

commit;
