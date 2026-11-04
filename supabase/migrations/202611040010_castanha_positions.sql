begin;

-- This machine has 33 positions. Retire the two provisional empty positions
-- from the earlier diagram without touching anything that has stock/history.
update public.machine_slots s
set active = false, updated_at = now()
from public.machines m
where s.machine_id = m.id
  and m.code = 'M2'
  and s.selection_code in ('27', '68')
  and s.product_id is null
  and s.quantity = 0
  and not exists (select 1 from public.sale_lines l where l.machine_slot_id = s.id)
  and not exists (select 1 from public.replenishment_lines l where l.machine_slot_id = s.id);

commit;
