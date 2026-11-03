"use client";

import { useState, useTransition } from "react";
import { registerInventoryCount } from "@/features/inventory/actions";

type Product = { id: string; name: string; internal_code: string };
type Machine = { id: string; name: string };
type Line = { product_id: string; quantity_counted: string };
const emptyLine = (): Line => ({ product_id: "", quantity_counted: "" });

export function InventoryForm({ products, machines }: { products: Product[]; machines: Machine[] }) {
  const [scope, setScope] = useState<"warehouse" | "machine">("warehouse");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5" onSubmit={(event) => {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const entries = lines.filter((line) => line.product_id && line.quantity_counted !== "");
    form.set("lines_json", JSON.stringify(entries.map((line) => ({ product_id: line.product_id, quantity_counted: Number(line.quantity_counted) }))));
    startTransition(() => { void (async () => { const result = await registerInventoryCount(form); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Local da contagem<select name="scope" value={scope} onChange={(event) => setScope(event.target.value as "warehouse" | "machine")} className="field"><option value="warehouse">Armazém</option><option value="machine">Máquina</option></select></label>{scope === "machine" && <label className="text-sm font-medium">Máquina<select name="machine_id" required defaultValue="" className="field"><option value="" disabled>Escolher máquina</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>}</div>
    <label className="block text-sm font-medium">Justificação da contagem<textarea name="justification" required minLength={3} maxLength={1000} rows={2} className="field h-auto py-3" placeholder="Ex.: contagem física de rotina" /></label>
    <div className="space-y-3">{lines.map((line, index) => <div key={index} className="grid items-end gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_9rem_auto]"><label className="text-sm font-medium">Produto<select required value={line.product_id} onChange={(event) => setLines((current) => current.map((item, row) => row === index ? { ...item, product_id: event.target.value } : item))} className="field"><option value="" disabled>Escolher produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.internal_code}</option>)}</select></label><label className="text-sm font-medium">Quantidade contada<input required type="number" min="0" step="1" value={line.quantity_counted} onChange={(event) => setLines((current) => current.map((item, row) => row === index ? { ...item, quantity_counted: event.target.value } : item))} className="field" /></label><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, row) => row !== index))} aria-label="Remover linha" className="mb-0.5 h-11 rounded-xl border border-[var(--line)] px-3 text-slate-600 disabled:opacity-40">×</button></div>)}</div>
    <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium">+ Adicionar produto</button>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div><button disabled={pending || !products.length || (scope === "machine" && !machines.length)} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A confirmar…" : "Confirmar contagem"}</button></div>
  </form>;
}
