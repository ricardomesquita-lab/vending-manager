"use client";

import { useState, useTransition } from "react";
import { recordCashOperation } from "@/features/cash/actions";

type Machine = { id: string; name: string };
const todayInLisbon = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function CashOperationForm({ machine, defaultType = "collection" }: { machine: Machine; defaultType?: "collection" | "float_reinforcement" | "withdrawal" }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [requestKey, setRequestKey] = useState("");

  return <form className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-4" onSubmit={(event) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    form.set("request_key", key);
    startTransition(() => { void (async () => { const result = await recordCashOperation(form); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    <input type="hidden" name="machine_id" value={machine.id} />
    <label className="text-sm font-medium">Data do movimento<input name="operation_date" type="date" required defaultValue={todayInLisbon()} className="field" /></label>
    <label className="text-sm font-medium">Tipo de movimento<select name="operation_type" defaultValue={defaultType} className="field"><option value="collection">Dinheiro recolhido</option><option value="float_reinforcement">Reforço de caixa</option><option value="withdrawal">Retirada</option></select></label>
    <label className="text-sm font-medium">Valor (€)<input name="amount" type="number" min="0.01" step="0.01" required className="field" /></label>
    <label className="text-sm font-medium">Observações (opcional)<textarea name="notes" rows={2} maxLength={1000} className="field h-auto py-3" /></label>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A guardar…" : "Registar movimento"}</button>
  </form>;
}
