"use client";

import { useState, useTransition } from "react";
import { setMachinePrice } from "@/features/products/actions";

type Item = { id: string; name: string };

export function MachinePriceForm({ machines, products }: { machines: Item[]; products: Item[] }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-4" onSubmit={(event) => {
    event.preventDefault(); setError(""); const formData = new FormData(event.currentTarget);
    startTransition(() => { void (async () => { const result = await setMachinePrice(formData); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    <label className="text-sm font-medium">Máquina<select name="machine_id" required defaultValue="" className="field"><option value="" disabled>Escolher</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
    <label className="text-sm font-medium sm:col-span-2">Produto<select name="product_id" required defaultValue="" className="field"><option value="" disabled>Escolher</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
    <label className="text-sm font-medium">Preço com IVA (€)<input name="sale_price_gross" required type="number" min="0" step="0.01" className="field" /></label>
    {error && <p role="alert" className="text-sm text-red-700 sm:col-span-4">{error}</p>}
    <div className="sm:col-span-4"><button disabled={pending || !machines.length || !products.length} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A guardar…" : "Guardar preço por máquina"}</button></div>
  </form>;
}
