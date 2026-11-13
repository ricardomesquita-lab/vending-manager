"use client";

import { useActionState } from "react";
import { registerExpense } from "./actions";

const categories = [["electricity", "Eletricidade"], ["rent", "Renda"], ["maintenance", "Manutenção"], ["fuel_travel", "Combustível e deslocações"], ["commissions", "Comissões"], ["consumables", "Consumíveis"], ["other", "Outras despesas"]];
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

export function ExpenseForm({ machines, suppliers }: { machines: { id: string; name: string }[]; suppliers: { id: string; name: string }[] }) {
  const [error, action, pending] = useActionState(async (_: string | null, data: FormData) => registerExpense(data), null);
  return <form action={action} className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-sm">Data<input className="field" name="expense_date" type="date" defaultValue={today} required /></label>
    <label className="text-sm">Tipo de despesa<select className="field" name="category" required>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label className="text-sm">Valor total (€)<input className="field" name="amount_ex_vat" type="number" min="0.01" step="0.01" required /></label>
    <input type="hidden" name="vat_rate" value="0" />
    <label className="text-sm sm:col-span-2">Descrição<input className="field" name="description" maxLength={240} placeholder="Ex.: combustível, reparação…" required /></label>
    <label className="text-sm">Máquina<select className="field" name="machine_id"><option value="">Despesa geral</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
    <label className="text-sm">Fornecedor (opcional)<select className="field" name="supplier_id"><option value="">Sem fornecedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2 lg:col-span-3">{error}</p>}
    <div className="sm:col-span-2 lg:col-span-3"><button disabled={pending} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A registar…" : "Registar despesa"}</button></div>
  </form>;
}
