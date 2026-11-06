"use client";

import { useMemo, useState, useTransition } from "react";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { registerPurchase } from "@/features/purchases/actions";

type ProductChoice = { id: string; name: string; image_url?: string | null; vat_rate: number; average_cost_ex_vat: number };
type SupplierChoice = { id: string; name: string };
type Line = { product_id: string; quantity: string; unit_cost_ex_vat: string; vat_rate: string; discount_percent: string };
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const emptyLine = (): Line => ({ product_id: "", quantity: "1", unit_cost_ex_vat: "0", vat_rate: "23", discount_percent: "0" });

export function PurchaseForm({ suppliers, products }: { suppliers: SupplierChoice[]; products: ProductChoice[] }) {
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const grossTotal = useMemo(() => lines.reduce((sum, line) => {
    const base = Number(line.quantity) * Number(line.unit_cost_ex_vat) * (1 - Number(line.discount_percent) / 100);
    return sum + base * (1 + Number(line.vat_rate) / 100);
  }, 0), [lines]);

  function updateLine(index: number, changes: Partial<Line>) {
    setLines((current) => current.map((line, row) => row === index ? { ...line, ...changes } : line));
  }

  return <form className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5" onSubmit={(event) => {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const payload = lines.map((line) => ({
      product_id: line.product_id,
      quantity: Number(line.quantity),
      unit_cost_ex_vat: Number(line.unit_cost_ex_vat),
      vat_rate: Number(line.vat_rate),
      discount_percent: Number(line.discount_percent),
    }));
    form.set("lines_json", JSON.stringify(payload));
    startTransition(() => { void (async () => { const result = await registerPurchase(form); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm font-medium sm:col-span-1">Fornecedor<select name="supplier_id" required defaultValue="" className="field"><option value="" disabled>Escolher fornecedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
    </div>
    <div className="space-y-3">
      {lines.map((line, index) => <div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-6">
        <label className="text-sm font-medium sm:col-span-2">Produto<select required value={line.product_id} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); updateLine(index, { product_id: event.target.value, vat_rate: String(product?.vat_rate ?? 23), unit_cost_ex_vat: String(product?.average_cost_ex_vat ?? 0) }); }} className="field"><option value="" disabled>Escolher produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>{products.find((product) => product.id === line.product_id) && <span className="mt-2 flex items-center gap-2"><ProductThumbnail imageUrl={products.find((product) => product.id === line.product_id)?.image_url} name={products.find((product) => product.id === line.product_id)?.name ?? "Produto"} size="xs" /><span className="text-xs font-normal">{products.find((product) => product.id === line.product_id)?.name}</span></span>}</label>
        <label className="text-sm font-medium">Quantidade<input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="field" /></label>
        <label className="text-sm font-medium">Custo s/ IVA<input required type="number" min="0" step="0.0001" value={line.unit_cost_ex_vat} onChange={(event) => updateLine(index, { unit_cost_ex_vat: event.target.value })} className="field" /></label>
        <label className="text-sm font-medium">IVA (%)<input required type="number" min="0" max="100" step="0.01" value={line.vat_rate} onChange={(event) => updateLine(index, { vat_rate: event.target.value })} className="field" /></label>
        <div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm font-medium">Desconto (%)<input required type="number" min="0" max="100" step="0.01" value={line.discount_percent} onChange={(event) => updateLine(index, { discount_percent: event.target.value })} className="field" /></label><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, row) => row !== index))} aria-label="Remover linha" className="mb-0.5 h-11 rounded-xl border border-[var(--line)] px-3 text-slate-600 disabled:opacity-40">×</button></div>
      </div>)}
    </div>
    <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium">+ Adicionar produto</button>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4"><p className="text-sm text-[var(--muted)]">Total estimado com IVA <strong className="ml-2 text-base text-[var(--foreground)]">{euro.format(grossTotal)}</strong></p><button disabled={pending || suppliers.length === 0 || products.length === 0} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A registar…" : "Confirmar compra"}</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {(!suppliers.length || !products.length) && <p className="text-sm text-amber-800">Crie primeiro pelo menos um fornecedor e um produto.</p>}
  </form>;
}
