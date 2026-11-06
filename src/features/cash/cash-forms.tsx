"use client";

import { useState, useTransition } from "react";
import { closeCashDay, recordCashOperation } from "@/features/cash/actions";

type Machine = { id: string; name: string };
const todayInLisbon = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function CashForm({ machines, mode, machine }: { machines: Machine[]; mode: "operation" | "close"; machine?: Machine }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [requestKey, setRequestKey] = useState("");
  const isClose = mode === "close";
  return <form className={`grid gap-4 rounded-2xl border border-[var(--line)] bg-white ${isClose ? "p-5 sm:grid-cols-2" : "p-4"}`} onSubmit={(event) => {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget);
    if (!isClose) { const key = requestKey || crypto.randomUUID(); setRequestKey(key); form.set("request_key", key); }
    startTransition(() => { void (async () => { const result = isClose ? await closeCashDay(form) : await recordCashOperation(form); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    {isClose ? <label className="text-sm font-medium">Máquina<select name="machine_id" required defaultValue="" className="field"><option value="" disabled>Escolher máquina</option>{machines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <input type="hidden" name="machine_id" value={machine?.id ?? ""} />}
    <label className="text-sm font-medium">{isClose ? "Data da contagem" : "Data do movimento"}<input name={isClose ? "cash_date" : "operation_date"} type="date" required defaultValue={todayInLisbon()} className="field" /></label>
    {!isClose && <label className="text-sm font-medium">Tipo de movimento<select name="operation_type" className="field"><option value="collection">Dinheiro recolhido</option><option value="float_reinforcement">Reforço de caixa</option><option value="withdrawal">Retirada</option></select></label>}
    <label className="text-sm font-medium">{isClose ? "Dinheiro contado na máquina (€)" : "Valor (€)"}<input name={isClose ? "counted_cash" : "amount"} type="number" min="0" step="0.01" required className="field" /></label>
    <label className={`text-sm font-medium ${isClose ? "sm:col-span-2" : ""}`}>Observações (opcional)<textarea name="notes" rows={2} maxLength={1000} className="field h-auto py-3" /></label>
    {error && <p role="alert" className={`rounded-xl bg-red-50 p-3 text-sm text-red-700 ${isClose ? "sm:col-span-2" : ""}`}>{error}</p>}
    <div className={isClose ? "sm:col-span-2" : ""}><button disabled={pending || (isClose ? !machines.length : !machine)} className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 ${isClose ? "bg-slate-800" : "w-full bg-[var(--brand)]"}`}>{pending ? "A guardar…" : isClose ? "Registar contagem" : "Registar movimento"}</button></div>
  </form>;
}

export function CashOperationForm({ machine }: { machine: Machine }) { return <CashForm machines={[]} machine={machine} mode="operation" />; }
export function CashClosureForm({ machines }: { machines: Machine[] }) {
  return <details className="rounded-2xl border border-[var(--line)] bg-white p-5">
    <summary className="cursor-pointer font-semibold">Contar o dinheiro na máquina</summary>
    <p className="mt-2 mb-4 text-sm text-[var(--muted)]">Faça a contagem quando lhe for conveniente. Não é necessário contar todos os dias. A comparação considera o período desde a contagem anterior.</p>
    <CashForm machines={machines} mode="close" />
  </details>;
}
