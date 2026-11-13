"use client";

import { useState, useTransition } from "react";
import { voidSale } from "@/features/sales/actions";

export function VoidSaleControl({ saleId }: { saleId: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-4" onSubmit={(event) => {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); const reason = String(form.get("reason") ?? "");
    startTransition(() => { void (async () => { const result = await voidSale(saleId, reason); if (result) setError(result); else window.location.reload(); })(); });
  }}>
    <label className="min-w-56 flex-1 text-sm font-medium">Justificação da anulação<input name="reason" required minLength={3} maxLength={500} className="field" /></label>
    <button disabled={pending} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50">{pending ? "A anular…" : "Anular venda"}</button>
    <p className="w-full text-xs text-[var(--muted)]">Se o dinheiro já tiver sido devolvido, registe também uma retirada na página Reposições, em «Registar dinheiro da máquina».</p>
    {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
  </form>;
}
