create type public.expense_category as enum (
  'electricity', 'rent', 'maintenance', 'fuel_travel', 'commissions', 'consumables', 'other'
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category public.expense_category not null,
  description text not null,
  amount_ex_vat numeric(12,2) not null check (amount_ex_vat >= 0),
  vat_rate numeric(5,2) not null check (vat_rate between 0 and 100),
  amount_vat numeric(12,2) not null check (amount_vat >= 0),
  amount_inc_vat numeric(12,2) not null check (amount_inc_vat >= 0),
  machine_id uuid references public.machines(id),
  supplier_id uuid references public.suppliers(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index expenses_date_category_idx on public.expenses (expense_date desc, category);
alter table public.expenses enable row level security;
create policy "Authenticated users can read expenses" on public.expenses for select to authenticated using (true);
grant select on public.expenses to authenticated;

create function public.register_expense(
  p_expense_date date,
  p_category public.expense_category,
  p_description text,
  p_amount_ex_vat numeric,
  p_vat_rate numeric,
  p_machine_id uuid default null,
  p_supplier_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_vat numeric(12,2);
  v_ex numeric(12,2);
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'administrator' then
    raise exception 'Apenas administradores podem registar despesas.' using errcode = '42501';
  end if;
  if p_expense_date is null or p_category is null or nullif(btrim(p_description), '') is null
     or p_amount_ex_vat is null or p_amount_ex_vat < 0
     or p_vat_rate is null or p_vat_rate < 0 or p_vat_rate > 100 then
    raise exception 'Indique data, categoria, descrição, valor e IVA válidos.' using errcode = '22023';
  end if;
  if p_machine_id is not null and not exists (select 1 from public.machines where id = p_machine_id) then
    raise exception 'Máquina inválida.' using errcode = '22023';
  end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id) then
    raise exception 'Fornecedor inválido.' using errcode = '22023';
  end if;
  v_ex := round(p_amount_ex_vat, 2);
  v_vat := round(v_ex * p_vat_rate / 100, 2);
  insert into public.expenses (expense_date, category, description, amount_ex_vat, vat_rate, amount_vat, amount_inc_vat, machine_id, supplier_id, created_by)
  values (p_expense_date, p_category, btrim(p_description), v_ex, p_vat_rate, v_vat, v_ex + v_vat, p_machine_id, p_supplier_id, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.register_expense(date, public.expense_category, text, numeric, numeric, uuid, uuid) to authenticated;
