-- Demonstration seed: the three initial machines only. No sales, purchases,
-- users, products, or real business data are fabricated here.
insert into public.machines (code, name, location)
values
  ('M1', 'Máquina 1', ''),
  ('M2', 'Máquina 2', ''),
  ('M3', 'Máquina 3', '')
on conflict (code) do nothing;
