"use client";

import { MachineSlotMap, type MachineSlot, type SlotProduct } from "@/features/machines/machine-slot-map";

type Machine = { id: string; name: string; code: string };

export function ReplenishmentForm({ machines, slotProducts, slots, isAdmin }: { machines: Machine[]; slotProducts: SlotProduct[]; slots: MachineSlot[]; isAdmin: boolean }) {
  const supportedCodes = new Set(["M1", "M2", "M3"]);
  const supportedMachines = machines.filter((machine) => supportedCodes.has(machine.code));
  const unsupportedMachines = machines.filter((machine) => !supportedCodes.has(machine.code));

  return <div className="space-y-4">
    <p className="text-sm text-[var(--muted)]">Escolhe uma posição em qualquer máquina para registar a reposição. As três máquinas estão visíveis ao mesmo tempo.</p>
    <div className="grid items-start gap-4 xl:grid-cols-3">
      {supportedMachines.map((machine) => <article key={machine.id} className="min-w-0 rounded-2xl border border-[var(--line)] bg-slate-50 p-3 sm:p-4">
        <h3 className="mb-3 px-1 text-base font-semibold">{machine.name}</h3>
        <MachineSlotMap machineId={machine.id} machineCode={machine.code} slots={slots.filter((slot) => slot.machine_id === machine.id)} products={slotProducts} mode="replenishment" isAdmin={isAdmin} />
      </article>)}
      {unsupportedMachines.map((machine) => <article key={machine.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">O esquema de reposição de {machine.name} ainda não está configurado.</article>)}
      {!machines.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não há máquinas ativas para registar reposições.</p>}
    </div>
  </div>;
}
