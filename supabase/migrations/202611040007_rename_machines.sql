update public.machines
set name = case code
  when 'M1' then 'Máquina Café'
  when 'M2' then 'Máquina Castanha'
  when 'M3' then 'Máquina Preta'
  else name
end,
updated_at = now()
where code in ('M1', 'M2', 'M3');
