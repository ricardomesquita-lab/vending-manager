"use client";

import { useState, useTransition } from "react";
import { createProduct, updateProduct } from "@/features/products/actions";

type Choice = { id: string; name: string };
type ExistingProduct = { id: string; barcode: string | null; name: string; category_id: string; description: string; preferred_supplier_id: string | null; vat_rate: number; sale_price_gross: number; average_cost_ex_vat: number; warehouse_minimum: number; machine_minimum: number; active: boolean };

export function ProductForm({ categories, suppliers, product }: { categories: Choice[]; suppliers: Choice[]; product?: ExistingProduct }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault(); setError(""); const formData = new FormData(event.currentTarget);
      startTransition(() => { void (async () => { const result = product ? await updateProduct(product.id, formData) : await createProduct(formData); if (result) setError(result); else window.location.reload(); })(); });
    }}>
      <label className="text-sm font-medium">Nome<input name="name" required maxLength={150} defaultValue={product?.name} className="field" /></label>
      <label className="text-sm font-medium">Categoria<select name="category_id" required defaultValue={product?.category_id ?? ""} className="field"><option value="" disabled>Escolher categoria</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-medium">Código de barras (opcional)<input name="barcode" maxLength={64} defaultValue={product?.barcode ?? ""} className="field" /></label>
      <label className="text-sm font-medium">Fornecedor preferencial<select name="preferred_supplier_id" defaultValue={product?.preferred_supplier_id ?? ""} className="field"><option value="">Sem fornecedor definido</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {!product && <label className="text-sm font-medium">Custo inicial sem IVA (€)<input name="average_cost_ex_vat" type="number" min="0" step="0.0001" defaultValue="0" required className="field" /></label>}
      {product && <p className="text-sm text-[var(--muted)]">Custo médio atual: {product.average_cost_ex_vat.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} € · Atualizado pelas compras.</p>}
      <label className="text-sm font-medium">IVA (%)<input name="vat_rate" type="number" min="0" max="100" step="0.01" defaultValue={product?.vat_rate ?? 23} required className="field" /></label>
      <label className="text-sm font-medium">Preço de venda com IVA (€)<input name="sale_price_gross" type="number" min="0" step="0.01" defaultValue={product?.sale_price_gross} required className="field" /></label>
      <label className="text-sm font-medium">Stock mínimo no armazém<input name="warehouse_minimum" type="number" min="0" step="1" defaultValue={product?.warehouse_minimum ?? 0} required className="field" /></label>
      <label className="text-sm font-medium">Stock mínimo por máquina<input name="machine_minimum" type="number" min="0" step="1" defaultValue={product?.machine_minimum ?? 0} required className="field" /></label>
      <label className="text-sm font-medium sm:col-span-2">Descrição (opcional)<textarea name="description" rows={2} maxLength={1000} defaultValue={product?.description ?? ""} className="field h-auto py-3" /></label>
      {product && <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={product.active} className="h-4 w-4 accent-[var(--brand)]" /> Produto ativo</label>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><button disabled={pending || categories.length === 0} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A guardar…" : product ? "Guardar alterações" : "Criar produto"}</button></div>
    </form>
  );
}
