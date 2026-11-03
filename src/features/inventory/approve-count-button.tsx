"use client";

import { useState, useTransition } from "react";
import { approveInventoryCount } from "@/features/inventory/actions";

export function ApproveCountButton({ countId }: { countId: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <div className="mt-4"><button disabled={pending} onClick={() => {
    setError("");
    startTransition(() => { void (async () => { const result = await approveInventoryCount(countId); if (result) setError(result); else window.location.reload(); })(); });
  }} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A autorizar…" : "Autorizar correção"}</button>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
