import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { CashClosureForm, CashOperationForm } from "@/features/cash/cash-forms";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeZone: "Europe/Lisbon" });

export default async function CashPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: machines }, { data: operations, error: operationsError }, { data: closures, error: closuresError }] = await Promise.all([
    supabase.from("machines").select("id,name").eq("status", "active").order("name"),
    supabase.from("cash_operations").select("id,machine_id,operation_date,operation_type,amount,notes,created_at,created_by,machines(name)").order("created_at", { ascending: false }).limit(50),
    supabase.from("cash_closures").select("id,machine_id,cash_date,sales_total,collected_total,reinforcement_total,withdrawal_total,expected_cash,counted_cash,difference,notes,needs_review,created_at,created_by,machines(name)").order("cash_date", { ascending: false }).limit(30),
  ]);

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Caixa</h1></header>
    <PhaseTwoNav />
    <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Recolhas e movimentos de caixa</h2><CashOperationForm machines={machines ?? []} /></section>
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Fecho diário</h2><p className="mb-3 text-sm text-[var(--muted)]">O valor esperado considera vendas em dinheiro, reforços, retiradas e recolhas registadas para a data.</p><CashClosureForm machines={machines ?? []} /></section>
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Fechos recentes</h2>{closuresError ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os fechos. Confirme se a migration da Fase 3 foi aplicada.</p> : closures?.length ? <div className="space-y-3">{closures.map((close) => <article key={close.id} className="rounded-2xl border border-[var(--line)] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{close.machines?.[0]?.name ?? "Máquina"} · {dateFormat.format(new Date(`${close.cash_date}T12:00:00Z`))}</h3><span className={`rounded-full px-2.5 py-1 text-xs ${close.difference === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>Diferença {euro.format(close.difference)}</span></div><p className="mt-1 text-xs text-[var(--muted)]">Fecho por utilizador {close.created_by.slice(0, 8)}</p><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><p>Vendas registadas<strong className="mt-1 block">{euro.format(close.sales_total)}</strong></p><p>Dinheiro esperado<strong className="mt-1 block">{euro.format(close.expected_cash)}</strong></p><p>Dinheiro contado<strong className="mt-1 block">{euro.format(close.counted_cash)}</strong></p><p>Recolhido<strong className="mt-1 block">{euro.format(close.collected_total)}</strong></p></div>{close.needs_review && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Uma venda deste dia foi anulada após o fecho. Reveja a diferença de caixa.</p>}{close.notes && <p className="mt-3 text-sm text-slate-600">{close.notes}</p>}</article>)}</div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há fechos de caixa.</p>}</section>
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Movimentos recentes</h2>{operationsError ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os movimentos de caixa.</p> : operations?.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Utilizador</th><th className="px-4 py-3 text-right">Valor</th></tr></thead><tbody>{operations.map((operation) => <tr key={operation.id} className="border-b last:border-0"><td className="px-4 py-3">{dateFormat.format(new Date(`${operation.operation_date}T12:00:00Z`))}</td><td className="px-4 py-3">{operation.machines?.[0]?.name ?? "Máquina"}</td><td className="px-4 py-3">{operation.operation_type === "collection" ? "Recolha" : operation.operation_type === "float_reinforcement" ? "Reforço" : "Retirada"}</td><td className="px-4 py-3 font-mono text-xs">{operation.created_by.slice(0, 8)}</td><td className="px-4 py-3 text-right font-medium">{euro.format(operation.amount)}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há movimentos de caixa.</p>}</section>
  </main>;
}
