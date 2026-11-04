"use client";

import { useState, useTransition } from "react";
import { registerReplenishment } from "@/features/replenishments/actions";

type Product = { id: string; name: string; available: number };
type Machine = { id: string; name: string };
type Line = { product_id: string; quantity: string };
const emptyLine = (): Line => ({ product_id: "", quantity: "1" });

export function ReplenishmentForm({ machines, products }: { machines: Machine[]; products: Product[] }) {
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5" onSubmit={(event) => {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    form.set("lines_json", JSON.stringify(lines.map((line) => ({ product_id: line.product_id, quantity: Number(line.quantity) }))));
    form.set("request_key", crypto.randomUUID());
    startTransition(() => { void (async () => { const result = await registerReplenishment(form); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Máquina<select name="machine_id" required defaultValue="" className="field"><option value="" disabled>Escolher máquina</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label><label className="text-sm font-medium">Observações (opcional)<input name="notes" maxLength={1000} className="field" /></label></div>
    <div className="space-y-3">{lines.map((line, index) => <div key={index} className="grid items-end gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_9rem_auto]"><label className="text-sm font-medium">Produto<select required value={line.product_id} onChange={(event) => setLines((current) => current.map((item, row) => row === index ? { ...item, product_id: event.target.value } : item))} className="field"><option value="" disabled>Escolher produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.available} em armazém</option>)}</select></label><label className="text-sm font-medium">Quantidade<input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, row) => row === index ? { ...item, quantity: event.target.value } : item))} className="field" /></label><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, row) => row !== index))} aria-label="Remover linha" className="mb-0.5 h-11 rounded-xl border border-[var(--line)] px-3 text-slate-600 disabled:opacity-40">×</button></div>)}</div>
    <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium">+ Adicionar produto</button>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div><button disabled={pending || !machines.length || !products.length} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A registar…" : "Confirmar reposição"}</button></div>
    {(!machines.length || !products.length) && <p className="text-sm text-amber-800">É necessário ter máquinas ativas, produtos e stock disponível no armazém.</p>}
  </form>;
}
