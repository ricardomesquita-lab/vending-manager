"use client";

import { useSyncExternalStore } from "react";

export type DashboardCardData = { id: string; title: string; value: string; note?: string };
const storageKey = "vending-dashboard-cards-v1";
const defaultVisible = ["month-sales", "month-expenses", "gross-margin", "operating-result"];
const defaultSnapshot = JSON.stringify(defaultVisible);
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}

function getSnapshot() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) return JSON.stringify(parsed.filter((id): id is string => typeof id === "string"));
    }
  } catch { /* Se o armazenamento local estiver indisponível, usa os cartões padrão. */ }
  return defaultSnapshot;
}

function getServerSnapshot() { return defaultSnapshot; }

export function DashboardCards({ cards }: { cards: DashboardCardData[] }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const visible = JSON.parse(snapshot) as string[];

  function toggle(id: string) {
    const next = visible.includes(id) ? visible.filter((item) => item !== id) : [...visible, id];
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* A alteração continua ativa nesta página. */ }
    listeners.forEach((listener) => listener());
  }

  const visibleCards = cards.filter((card) => visible.includes(card.id));

  return <>
    <details className="mt-4 rounded-xl border border-[var(--line)] bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium">Personalizar cartões do painel</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{cards.map((card) => <label key={card.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><input type="checkbox" checked={visible.includes(card.id)} onChange={() => toggle(card.id)} className="h-4 w-4 accent-[var(--brand)]" />{card.title}</label>)}</div>
    </details>
    {visibleCards.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{visibleCards.map((card) => <article key={card.id} className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted)]">{card.title}</p><strong className="mt-2 block text-2xl">{card.value}</strong>{card.note && <p className="mt-1 text-xs text-[var(--muted)]">{card.note}</p>}</article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">Escolhe pelo menos um cartão para mostrar no painel.</p>}
  </>;
}
