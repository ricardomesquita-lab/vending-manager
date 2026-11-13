import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { machinePanelClasses, machinePanelHeadingClasses } from "@/features/machines/machine-panel-colors";
import { ReplenishmentForm } from "@/features/replenishments/replenishment-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" });

export default async function ReplenishmentsPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: machines }, { data: warehouse }, { data: productsData }, { data: machineSlots }, { data: machinePrices }, { data: replenishments, error }, { data: cashOperations, error: cashError }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("machines").select("id,name,code").eq("status", "active").order("name"),
    supabase.from("warehouse_stock").select("product_id,quantity,products(id,name)").gt("quantity", 0).order("product_id"),
    supabase.from("products").select("id,name,image_url,sale_price_gross,active").eq("active", true).order("name"),
    supabase.from("machine_slots").select("id,machine_id,selection_code,product_id,quantity,capacity,active,products(id,name,image_url,sale_price_gross,active)").eq("active", true).order("selection_code"),
    supabase.from("machine_product_prices").select("machine_id,product_id,sale_price_gross"),
    supabase.from("replenishments").select("id,created_at,notes,machines(name,code),profiles(full_name),replenishment_lines(quantity,products(name,image_url),machine_slots(selection_code))").order("created_at", { ascending: false }).limit(50),
    supabase.from("cash_operations").select("id,machine_id,operation_date,operation_type,amount,created_at,created_by,machines(name)").order("created_at", { ascending: false }).limit(50),
  ]);
  const warehouseByProduct = new Map((warehouse ?? []).map((row) => [row.product_id, row.quantity]));
  const priceOverrides = new Map((machinePrices ?? []).map((row) => [`${row.machine_id}:${row.product_id}`, Number(row.sale_price_gross)]));
  const slotProducts = (productsData ?? []).map((product) => ({ ...product, warehouse_quantity: warehouseByProduct.get(product.id) ?? 0 }));
  const slotOptions = (machineSlots ?? []).map((slot) => ({ ...slot, product: slot.products?.[0] ?? null, price: slot.product_id ? priceOverrides.get(`${slot.machine_id}:${slot.product_id}`) ?? null : null }));

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Reposições e vendas</h1><p className="mt-1 text-sm text-[var(--muted)]">Regista reposições, vendas e retiradas de dinheiro numa só página.</p></header>
    <PhaseTwoNav />
    <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Nova reposição</h2><ReplenishmentForm machines={machines ?? []} slotProducts={slotProducts} slots={slotOptions} isAdmin={profile?.role === "administrator"} /></section>
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Histórico recente</h2>
      {error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar as reposições. Confirme se as migrations foram aplicadas.</p> : replenishments?.length ? <div className="space-y-3">{replenishments.map((item) => {
        const code = item.machines?.[0]?.code;
        const dark = code === "M3";
        return <article key={item.id} className={`rounded-2xl border p-5 ${machinePanelClasses(code)} ${dark ? "text-white" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={`font-semibold ${machinePanelHeadingClasses(code)}`}>{item.machines?.[0]?.name ?? "Máquina"}</h3><time className={`text-sm ${dark ? "text-neutral-300" : "text-[var(--muted)]"}`}>{dateFormat.format(new Date(item.created_at))}</time></div>
          <p className={`mt-1 text-xs ${dark ? "text-neutral-300" : "text-[var(--muted)]"}`}>Registado por {item.profiles?.[0]?.full_name || "utilizador"}</p>
          <ul className="mt-3 flex flex-wrap gap-2">{item.replenishment_lines.map((line, index) => { const product = line.products?.[0]; return <li key={`${item.id}-${index}`} className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-sm text-slate-800"><ProductThumbnail imageUrl={product?.image_url} name={product?.name ?? "Produto"} size="xs" />{product?.name ?? "Produto"} · {line.quantity} un.{line.machine_slots?.[0]?.selection_code ? ` · Posição ${line.machine_slots[0].selection_code}` : ""}</li>; })}</ul>
          {item.notes && <p className={`mt-3 text-sm ${dark ? "text-neutral-200" : "text-slate-600"}`}>{item.notes}</p>}
        </article>;
      })}</div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há reposições registadas.</p>}
    </section>
    <section id="movimentos-dinheiro" className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Movimentos de dinheiro recentes</h2>
      {cashError ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os movimentos de dinheiro.</p> : cashOperations?.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Utilizador</th><th className="px-4 py-3 text-right">Valor</th></tr></thead><tbody>{cashOperations.map((operation) => <tr key={operation.id} className="border-b last:border-0"><td className="px-4 py-3">{new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(`${operation.operation_date}T12:00:00Z`))}</td><td className="px-4 py-3">{operation.machines?.[0]?.name ?? "Máquina"}</td><td className="px-4 py-3">{operation.operation_type === "collection" ? "Dinheiro recolhido" : operation.operation_type === "float_reinforcement" ? "Reforço" : "Retirada"}</td><td className="px-4 py-3 font-mono text-xs">{operation.created_by.slice(0, 8)}</td><td className="px-4 py-3 text-right font-medium">{new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(operation.amount)}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há movimentos de dinheiro registados.</p>}
    </section>
  </main>;
}
