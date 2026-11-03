import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { SalesForm } from "@/features/sales/sales-form";
import { VoidSaleControl } from "@/features/sales/void-sale-control";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeZone: "Europe/Lisbon" });

export default async function SalesPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: machines }, { data: stock }, { data: machinePrices }, { data: sales, error }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("machines").select("id,name").eq("status", "active").order("name"),
    supabase.from("machine_stock").select("machine_id,product_id,quantity,products(id,name,internal_code,vat_rate,sale_price_gross,active)").gt("quantity", 0),
    supabase.from("machine_product_prices").select("machine_id,product_id,sale_price_gross"),
    supabase.from("sales").select("id,machine_id,sale_date,status,total_inc_vat,total_ex_vat,total_cost_ex_vat,gross_margin,created_at,created_by,void_reason,machines(name),sale_lines(product_id,quantity,line_total_inc_vat,products(name))").order("created_at", { ascending: false }).limit(50),
  ]);
  const overrides = new Map((machinePrices ?? []).map((row) => [`${row.machine_id}:${row.product_id}`, Number(row.sale_price_gross)]));
  const products = (stock ?? []).flatMap((row) => {
    const product = row.products?.[0];
    if (!product?.active) return [];
    return [{ id: product.id, name: product.name, internal_code: product.internal_code, machine_id: row.machine_id, quantity: row.quantity, vat_rate: Number(product.vat_rate), price: overrides.get(`${row.machine_id}:${row.product_id}`) ?? Number(product.sale_price_gross) }];
  });
  const isAdmin = profile?.role === "administrator";

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Vendas</h1></header>
    <PhaseTwoNav />
    <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Registar venda</h2><SalesForm machines={machines ?? []} products={products} /></section>
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Histórico operacional</h2>{error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar as vendas. Confirme se a migration da Fase 3 foi aplicada.</p> : sales?.length ? <div className="space-y-3">{sales.map((sale) => <article key={sale.id} className={`rounded-2xl border border-[var(--line)] bg-white p-5 ${sale.status === "voided" ? "opacity-70" : ""}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{sale.machines?.[0]?.name ?? "Máquina"} · {dateFormat.format(new Date(`${sale.sale_date}T12:00:00Z`))}</h3><p className="mt-1 text-xs text-[var(--muted)]">{new Date(sale.created_at).toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" })} · Utilizador {sale.created_by.slice(0, 8)}</p></div><div className="text-right"><span className={`rounded-full px-2.5 py-1 text-xs ${sale.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{sale.status === "confirmed" ? "Confirmada" : "Anulada"}</span><p className="mt-2 text-lg font-semibold">{euro.format(sale.total_inc_vat)}</p></div></div><ul className="mt-4 flex flex-wrap gap-2">{sale.sale_lines.map((line) => <li key={line.product_id} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm">{line.products?.[0]?.name ?? "Produto"} · {line.quantity} un.</li>)}</ul><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--muted)]"><span>Sem IVA: {euro.format(sale.total_ex_vat)}</span><span>Custo: {euro.format(sale.total_cost_ex_vat)}</span><span>Margem bruta: {euro.format(sale.gross_margin)}</span></div>{sale.void_reason && <p className="mt-3 text-sm text-red-700">Justificação: {sale.void_reason}</p>}{isAdmin && sale.status === "confirmed" && <VoidSaleControl saleId={sale.id} />}</article>)}</div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há vendas registadas.</p>}</section>
  </main>;
}
