"use client";

import { useState } from "react";
import { ProductForm } from "@/features/products/product-form";

type Choice = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  category_id: string;
  description: string;
  preferred_supplier_id: string | null;
  vat_rate: number;
  sale_price_gross: number;
  average_cost_ex_vat: number;
  warehouse_minimum: number;
  machine_minimum: number;
  active: boolean;
};

export function ProductEditDialog({ categories, suppliers, product }: { categories: Choice[]; suppliers: Choice[]; product: Product }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="rounded-lg px-2 py-1 text-sm font-medium text-[var(--brand)] hover:bg-emerald-50">Editar</button>
    {open && <div className="fixed inset-0 z-20 overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={`edit-product-${product.id}`} className="mx-auto my-8 max-w-3xl rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-4"><h2 id={`edit-product-${product.id}`} className="text-lg font-semibold">Editar {product.name}</h2><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">Fechar</button></div>
        <ProductForm categories={categories} suppliers={suppliers} product={product} />
      </section>
    </div>}
  </>;
}
