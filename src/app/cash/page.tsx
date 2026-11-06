import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { CashOperationForm } from "@/features/cash/cash-forms";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeZone: "Europe/Lisbon" });

export default async function CashPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: machines }, { data: operations, error: operationsError }] = await Promise.all([
    supabase.from("machines").select("id,name").eq("status", "active").order("name"),
    supabase.from("cash_operations").select("id,machine_id,operation_date,operation_type,amount,notes,created_at,created_by,machines(name)").order("created_at", { ascending: false }).limit(50),
  ]);

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Caixa</h1><p className="mt-1 text-sm text-[var(--muted)]">Regista apenas recolhas, reforços ou retiradas quando acontecerem.</p></header>
    <PhaseTwoNav />

    <section className="mt-7">
      <h2 className="mb-2 text-lg font-semibold">Movimentos de caixa</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">Regista o valor que foi recolhido, acrescentado ou retirado da máquina.</p>
      {machines?.length ? <div className="grid items-start gap-4 xl:grid-cols-3">{machines.map((machine) => <article key={machine.id} className="min-w-0 rounded-2xl border border-[var(--line)] bg-slate-50 p-3 sm:p-4"><h3 className="mb-3 px-1 text-base font-semibold">{machine.name}</h3><CashOperationForm machine={machine} /></article>)}</div> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não há máquinas ativas para registar movimentos.</p>}
    </section>

    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Movimentos recentes</h2>
      {operationsError ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os movimentos de caixa.</p> : operations?.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Utilizador</th><th className="px-4 py-3 text-right">Valor</th></tr></thead><tbody>{operations.map((operation) => <tr key={operation.id} className="border-b last:border-0"><td className="px-4 py-3">{dateFormat.format(new Date(`${operation.operation_date}T12:00:00Z`))}</td><td className="px-4 py-3">{operation.machines?.[0]?.name ?? "Máquina"}</td><td className="px-4 py-3">{operation.operation_type === "collection" ? "Recolha" : operation.operation_type === "float_reinforcement" ? "Reforço" : "Retirada"}</td><td className="px-4 py-3 font-mono text-xs">{operation.created_by.slice(0, 8)}</td><td className="px-4 py-3 text-right font-medium">{euro.format(operation.amount)}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há movimentos registados.</p>}
    </section>
  </main>;
}
