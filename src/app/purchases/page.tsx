import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeZone: "Europe/Lisbon" });

export default async function PurchasesPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: suppliers }, { data: products }, { data: purchases, error }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("suppliers").select("id,name").eq("active", true).order("name"),
    supabase.from("products").select("id,name,internal_code,vat_rate,average_cost_ex_vat").eq("active", true).order("name"),
    supabase.from("purchases").select("id,invoice_number,purchase_date,total_inc_vat,suppliers(name)").order("purchase_date", { ascending: false }).limit(50),
  ]);
  const isAdmin = profile?.role === "administrator";

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Compras</h1></header>
    <PhaseTwoNav />
    {isAdmin && <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Registar compra</h2><PurchaseForm suppliers={suppliers ?? []} products={products ?? []} /></section>}
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Histórico recente</h2>
      {error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar as compras. Confirme se as migrations foram aplicadas.</p> : purchases?.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Fatura</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3 text-right">Total com IVA</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id} className="border-b last:border-0"><td className="px-4 py-3">{dateFormat.format(new Date(`${purchase.purchase_date}T12:00:00Z`))}</td><td className="px-4 py-3">{purchase.invoice_number}</td><td className="px-4 py-3">{purchase.suppliers?.[0]?.name ?? "—"}</td><td className="px-4 py-3 text-right font-medium">{euro.format(purchase.total_inc_vat)}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há compras registadas.</p>}
    </section>
  </main>;
}
