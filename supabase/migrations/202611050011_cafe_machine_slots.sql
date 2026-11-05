begin;

insert into public.machine_slots (machine_id, selection_code)
select m.id, slot.selection_code
from public.machines m
cross join (values
  ('21'), ('22'), ('23'), ('24'), ('25'), ('26'),
  ('41'), ('43'), ('44'), ('45'),
  ('51'), ('52'), ('53'), ('54'), ('55'), ('56')
) as slot(selection_code)
where m.code = 'M1'
on conflict (machine_id, selection_code) do nothing;

commit;
