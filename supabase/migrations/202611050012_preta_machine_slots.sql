begin;

insert into public.machine_slots (machine_id, selection_code)
select m.id, slot.selection_code
from public.machines m
cross join (values
  ('11'), ('12'), ('13'),
  ('21'), ('22'), ('23'), ('24'), ('25'), ('26'),
  ('31'), ('32'), ('33'), ('34'), ('35'), ('36'),
  ('41'), ('42'), ('43'), ('44'), ('45'), ('46'),
  ('51'), ('52'), ('53'), ('54'), ('55'), ('56'),
  ('61'), ('62'), ('63'), ('64'), ('65')
) as slot(selection_code)
where m.code = 'M3'
on conflict (machine_id, selection_code) do nothing;

commit;
