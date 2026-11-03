"use client";

import { useActionState } from "react";
import { registerExpense } from "./actions";

const categories = [["electricity", "Eletricidade"], ["rent", "Renda"], ["maintenance", "Manutenção"], ["fuel_travel", "Combustível e deslocações"], ["commissions", "Comissões"], ["consumables", "Consumíveis"], ["other", "Outras despesas"]];
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

export function ExpenseForm({ machines, suppliers }: { machines: {id:string;name:string}[]; suppliers: {id:string;name:string}[] }) {
  const [error, action, pending] = useActionState(async (_: string | null, data: FormData) => registerExpense(data), null);
  return <form action={action} className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
    <label className="text-sm">Data<input className="field" name="expense_date" type="date" defaultValue={today} required /></label>
    <label className="text-sm">Categoria<select className="field" name="category" required>{categories.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
    <label className="text-sm sm:col-span-2">Descrição<input className="field" name="description" maxLength={240} required /></label>
    <label className="text-sm">Valor sem IVA (€)<input className="field" name="amount_ex_vat" type="number" min="0" step="0.01" required /></label>
    <label className="text-sm">IVA (%)<input className="field" name="vat_rate" type="number" min="0" max="100" step="0.01" defaultValue="23" required /></label>
    <label className="text-sm">Máquina associada<select className="field" name="machine_id"><option value="">Sem máquina</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label className="text-sm">Fornecedor<select className="field" name="supplier_id"><option value="">Sem fornecedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error && <p role="alert" className="sm:col-span-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="sm:col-span-4"><button disabled={pending} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending?"A registar…":"Registar despesa"}</button></div>
  </form>;
}
