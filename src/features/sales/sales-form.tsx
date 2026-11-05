"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { registerSale } from "@/features/sales/actions";
import { MachineSlotMap, type MachineSlot } from "@/features/machines/machine-slot-map";

type Machine = { id: string; name: string; code: string };
type Product = { id: string; name: string; machine_id: string; quantity: number; vat_rate: number; price: number };
type Line = { product_id: string; quantity: string };
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const emptyLine = (): Line => ({ product_id: "", quantity: "1" });
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function SalesForm({ machines, products, slots, isAdmin }: { machines: Machine[]; products: Product[]; slots: MachineSlot[]; isAdmin: boolean }) {
  const [machineId, setMachineId] = useState("");
  const [saleDate, setSaleDate] = useState(localToday());
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [requestKey, setRequestKey] = useState("");
  const selectedMachine = machines.find((machine) => machine.id === machineId);
  const hasInteractiveMap = selectedMachine?.code === "M1" || selectedMachine?.code === "M2" || selectedMachine?.code === "M3";
  const availableProducts = products.filter((product) => product.machine_id === machineId && product.quantity > 0);
  const total = useMemo(() => lines.reduce((sum, line) => {
    const product = availableProducts.find((item) => item.id === line.product_id);
    return sum + (product ? Number(line.quantity) * product.price : 0);
  }, 0), [lines, availableProducts]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasInteractiveMap) return;
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("lines_json", JSON.stringify(lines.map((line) => ({ product_id: line.product_id, quantity: Number(line.quantity) }))));
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    form.set("request_key", key);
    startTransition(() => { void (async () => { try { const result = await registerSale(form); if (result) setError(result); else window.location.reload(); } catch { setError("Não foi possível confirmar a resposta. Pode repetir sem duplicar a venda."); } })(); });
  }

  return <div className="space-y-4">
    <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2">
      <label className="text-sm font-medium">Máquina<select name="machine_id" required value={machineId} onChange={(event) => { setMachineId(event.target.value); setLines([emptyLine()]); setRequestKey(""); }} className="field"><option value="" disabled>Escolher máquina</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
      {!hasInteractiveMap && <label className="text-sm font-medium">Data da venda<input name="sale_date" required type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className="field" /></label>}
    </div>

    {hasInteractiveMap ? <MachineSlotMap machineId={machineId} machineCode={selectedMachine.code} slots={slots.filter((slot) => slot.machine_id === machineId)} products={[]} mode="sale" isAdmin={isAdmin} saleDate={saleDate} /> : <form className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5" onSubmit={onSubmit}>
      <input type="hidden" name="machine_id" value={machineId} />
      <input type="hidden" name="sale_date" value={saleDate} />
      <div className="space-y-3">{lines.map((line, index) => { const selected = availableProducts.find((product) => product.id === line.product_id); return <div key={index} className="grid items-end gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_9rem_9rem_auto]"><label className="text-sm font-medium">Produto<select required value={line.product_id} onChange={(event) => setLines((current) => current.map((item, row) => row === index ? { ...item, product_id: event.target.value } : item))} disabled={!machineId} className="field"><option value="" disabled>{machineId ? "Escolher produto" : "Escolha uma máquina"}</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.quantity} un.</option>)}</select></label><label className="text-sm font-medium">Quantidade<input required type="number" min="1" max={selected?.quantity ?? undefined} step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, row) => row === index ? { ...item, quantity: event.target.value } : item))} className="field" /></label><p className="pb-3 text-sm text-slate-600">{selected ? euro.format(selected.price) + " / un." : "Preço / un."}</p><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, row) => row !== index))} aria-label="Remover linha" className="mb-0.5 h-11 rounded-xl border border-[var(--line)] px-3 text-slate-600 disabled:opacity-40">×</button></div>; })}</div>
      <button type="button" disabled={!availableProducts.length} onClick={() => setLines((current) => [...current, emptyLine()])} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium disabled:opacity-50">+ Adicionar produto</button>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!availableProducts.length && <p className="text-sm text-amber-800">A máquina selecionada não tem produtos com stock disponível.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4"><p className="text-sm text-[var(--muted)]">Total estimado <strong className="ml-2 text-base text-[var(--foreground)]">{euro.format(total)}</strong></p><button disabled={pending || !machineId || !availableProducts.length} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A registar…" : "Confirmar venda"}</button></div>
    </form>}
  </div>;
}
