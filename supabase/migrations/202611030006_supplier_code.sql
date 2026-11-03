alter table public.suppliers
  add column supplier_code text;

create unique index suppliers_supplier_code_unique
  on public.suppliers (lower(supplier_code))
  where supplier_code is not null;
