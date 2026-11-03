"use client";

import { useState, useTransition } from "react";
import { createSupplier, updateSupplier } from "@/features/suppliers/actions";

type Supplier = { id: string; name: string; supplier_code: string | null };

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
    event.preventDefault(); setError(""); const formData = new FormData(event.currentTarget);
    startTransition(() => { void (async () => { const result = supplier ? await updateSupplier(supplier.id, formData) : await createSupplier(formData); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    <label className="text-sm font-medium">Nome<input name="name" required maxLength={150} defaultValue={supplier?.name ?? ""} className="field" /></label>
    <label className="text-sm font-medium">Código do fornecedor<input name="supplier_code" required maxLength={50} defaultValue={supplier?.supplier_code ?? ""} className="field" /></label>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
    <div className="sm:col-span-2"><button disabled={pending} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A guardar…" : supplier ? "Guardar alterações" : "Criar fornecedor"}</button></div>
  </form>;
}
