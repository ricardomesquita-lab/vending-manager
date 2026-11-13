"use client";

import { useState } from "react";
import { MachineSlotMap, type MachineSlot, type SlotProduct } from "@/features/machines/machine-slot-map";
import { CashOperationForm } from "@/features/cash/cash-forms";
import { machinePanelClasses, machinePanelHeadingClasses } from "@/features/machines/machine-panel-colors";

type Machine = { id: string; name: string; code: string };

export function ReplenishmentForm({ machines, slotProducts, slots, isAdmin }: { machines: Machine[]; slotProducts: SlotProduct[]; slots: MachineSlot[]; isAdmin: boolean }) {
  const [mode, setMode] = useState<"replenishment" | "sale">("replenishment");
  const supportedCodes = new Set(["M1", "M2", "M3"]);
  const supportedMachines = machines.filter((machine) => supportedCodes.has(machine.code));
  const unsupportedMachines = machines.filter((machine) => !supportedCodes.has(machine.code));

  return <div className="space-y-4">
    <p className="text-sm text-[var(--muted)]">Regista a reposição ou a venda sem sair desta página. As três máquinas estão visíveis ao mesmo tempo.</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Operação nas máquinas">
      <button type="button" aria-pressed={mode === "replenishment"} onClick={() => setMode("replenishment")} className={`rounded-full border px-4 py-2 text-sm font-medium ${mode === "replenishment" ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-[var(--line)] bg-white text-slate-700"}`}>Repor produtos</button>
      <button id="operacoes-venda" type="button" aria-pressed={mode === "sale"} onClick={() => setMode("sale")} className={`rounded-full border px-4 py-2 text-sm font-medium ${mode === "sale" ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-[var(--line)] bg-white text-slate-700"}`}>Registar vendas</button>
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-3">
      {supportedMachines.map((machine) => <article key={machine.id} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${machinePanelClasses(machine.code)}`}>
        <h3 className={`mb-3 px-1 text-base font-semibold ${machinePanelHeadingClasses(machine.code)}`}>{machine.name}</h3>
        <MachineSlotMap machineId={machine.id} machineCode={machine.code} slots={slots.filter((slot) => slot.machine_id === machine.id)} products={slotProducts} mode={mode} isAdmin={isAdmin} />
        <details className="mt-4 rounded-xl border border-[var(--line)] bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold">Registar dinheiro da máquina</summary>
          <div className="mt-3"><CashOperationForm machine={machine} defaultType="withdrawal" /></div>
        </details>
      </article>)}
      {unsupportedMachines.map((machine) => <article key={machine.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">O esquema de reposição de {machine.name} ainda não está configurado.</article>)}
      {!machines.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não há máquinas ativas para registar reposições.</p>}
    </div>
  </div>;
}
