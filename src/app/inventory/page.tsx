import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { ApproveCountButton } from "@/features/inventory/approve-count-button";
import { InventoryForm } from "@/features/inventory/inventory-form";
import { machinePanelClasses, machinePanelHeadingClasses } from "@/features/machines/machine-panel-colors";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" });

export default async function InventoryPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: products }, { data: machines }, { data: counts, error }] = await Promise.all([
    supabase.from("products").select("id,name,image_url").eq("active", true).order("name"),
    supabase.from("machines").select("id,name,code").eq("status", "active").order("name"),
    supabase.from("inventory_counts").select("id,scope,status,machine_id,justification,created_at,confirmed_at,machines(name,code),profiles(full_name),inventory_count_lines(product_id,quantity_before,quantity_counted,quantity_difference,products(name,image_url))").order("created_at", { ascending: false }).limit(30),
  ]);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Inventários</h1></header>
    <PhaseTwoNav />
    <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Nova contagem física</h2><InventoryForm products={products ?? []} machines={machines ?? []} /></section>
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Histórico de contagens</h2>
      {error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os inventários. Confirme se as migrations foram aplicadas.</p> : counts?.length ? <div className="space-y-3">{counts.map((count) => {
        const code = count.scope === "machine" ? count.machines?.[0]?.code : undefined;
        const dark = code === "M3";
        return <article key={count.id} className={`rounded-2xl border p-5 ${count.scope === "machine" ? machinePanelClasses(code) : "border-[var(--line)] bg-white"} ${dark ? "text-white" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={`font-semibold ${machinePanelHeadingClasses(code)}`}>{count.scope === "warehouse" ? "Armazém" : count.machines?.[0]?.name ?? "Máquina"}</h3><div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs ${count.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{count.status === "confirmed" ? "Correção autorizada" : "Pendente de autorização"}</span><time className={`text-sm ${dark ? "text-neutral-300" : "text-[var(--muted)]"}`}>{dateFormat.format(new Date(count.created_at))}</time></div></div>
          <p className={`mt-1 text-xs ${dark ? "text-neutral-300" : "text-[var(--muted)]"}`}>Contagem por {count.profiles?.[0]?.full_name || "utilizador"}</p>
          <ul className="mt-3 space-y-1 text-sm">{count.inventory_count_lines.map((line) => <li key={line.product_id} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><ProductThumbnail imageUrl={line.products?.[0]?.image_url} name={line.products?.[0]?.name ?? "Produto"} size="xs" />{line.products?.[0]?.name ?? "Produto"}</span><span className="shrink-0">{line.quantity_before} → {line.quantity_counted} <strong className={line.quantity_difference === 0 ? "text-emerald-700" : "text-amber-700"}>({line.quantity_difference > 0 ? "+" : ""}{line.quantity_difference})</strong></span></li>)}</ul>
          <p className={`mt-3 text-sm ${dark ? "text-neutral-300" : "text-slate-600"}`}>{count.justification}</p>
          {profile?.role === "administrator" && count.status === "pending_approval" && <ApproveCountButton countId={count.id} />}
        </article>;
      })}</div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há contagens registadas.</p>}
    </section>
  </main>;
}
