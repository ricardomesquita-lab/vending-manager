"use client";

import { MachineSlotMap, type MachineSlot } from "@/features/machines/machine-slot-map";

type Machine = { id: string; name: string; code: string };

export function SalesForm({ machines, slots, isAdmin }: { machines: Machine[]; slots: MachineSlot[]; isAdmin: boolean }) {
  const supportedCodes = new Set(["M1", "M2", "M3"]);
  const unsupportedMachines = machines.filter((machine) => !supportedCodes.has(machine.code));

  return <div className="grid items-start gap-4 xl:grid-cols-3">
    {machines.filter((machine) => supportedCodes.has(machine.code)).map((machine) => <article key={machine.id} className="min-w-0 rounded-2xl border border-[var(--line)] bg-slate-50 p-3 sm:p-4">
      <h3 className="mb-3 px-1 text-base font-semibold">{machine.name}</h3>
      <MachineSlotMap machineId={machine.id} machineCode={machine.code} slots={slots.filter((slot) => slot.machine_id === machine.id)} products={[]} mode="sale" isAdmin={isAdmin} />
    </article>)}
    {unsupportedMachines.map((machine) => <article key={machine.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">O esquema de vendas de {machine.name} ainda não está configurado.</article>)}
    {!machines.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não há máquinas ativas para registar vendas.</p>}
  </div>;
}
