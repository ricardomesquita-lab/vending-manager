import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { ProductForm } from "@/features/products/product-form";
import { ProductEditDialog } from "@/features/products/product-edit-dialog";
import { MachinePriceForm } from "@/features/products/machine-price-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export default async function ProductsPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: categories }, { data: suppliers }, { data: machines }, { data: machinePrices }, { data: priceHistory }, { data: products, error }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("product_categories").select("id,name").eq("active", true).order("name"),
    supabase.from("suppliers").select("id,name").eq("active", true).order("name"),
    supabase.from("machines").select("id,name").eq("status", "active").order("name"),
    supabase.from("machine_product_prices").select("id,sale_price_gross,machines(name),products(name)").order("created_at", { ascending: false }),
    supabase.from("product_price_history").select("id,sale_price_gross,changed_at,machines(name),products(name)").order("changed_at", { ascending: false }).limit(50),
    supabase.from("products").select("id,internal_code,barcode,name,category_id,description,preferred_supplier_id,vat_rate,sale_price_gross,average_cost_ex_vat,warehouse_minimum,machine_minimum,active,product_categories(name)").order("name"),
  ]);
  const isAdmin = profile?.role === "administrator";
  const activeProducts = (products ?? []).filter((product) => product.active).map(({ id, name }) => ({ id, name }));

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Produtos</h1></header>
    <PhaseTwoNav />
    {isAdmin && <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Novo produto</h2>{categories?.length ? <ProductForm categories={categories} suppliers={suppliers ?? []} /> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Execute a migration da Fase 2 para criar as categorias iniciais.</p>}</section>}
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Catálogo</h2><span className="text-sm text-[var(--muted)]">{products?.length ?? 0} produtos</span></div>
      {error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os produtos. Confirme se as migrations foram aplicadas.</p> : products?.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Custo s/ IVA</th><th className="px-4 py-3">Preço c/ IVA</th><th className="px-4 py-3">IVA</th><th className="px-4 py-3">Estado</th>{isAdmin && <th className="px-4 py-3">Ação</th>}</tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-b last:border-0"><td className="px-4 py-3"><span className="font-medium">{product.name}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{product.internal_code}</span></td><td className="px-4 py-3">{product.product_categories?.[0]?.name ?? "—"}</td><td className="px-4 py-3">{euro.format(product.average_cost_ex_vat)}</td><td className="px-4 py-3 font-medium">{euro.format(product.sale_price_gross)}</td><td className="px-4 py-3">{product.vat_rate}%</td><td className="px-4 py-3">{product.active ? "Ativo" : "Inativo"}</td>{isAdmin && <td className="px-4 py-3"><ProductEditDialog categories={categories ?? []} suppliers={suppliers ?? []} product={product} /></td>}</tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há produtos. Crie o primeiro produto para começar a gerir compras e stock.</p>}
    </section>
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Preços por máquina</h2>
      {isAdmin && <div className="mb-4"><MachinePriceForm machines={machines ?? []} products={activeProducts} /></div>}
      {machinePrices?.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white"><table className="w-full min-w-[480px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Máquina</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3 text-right">Preço com IVA</th></tr></thead><tbody>{machinePrices.map((price) => <tr key={price.id} className="border-b last:border-0"><td className="px-4 py-3">{price.machines?.[0]?.name ?? "Máquina"}</td><td className="px-4 py-3">{price.products?.[0]?.name ?? "Produto"}</td><td className="px-4 py-3 text-right font-medium">{euro.format(price.sale_price_gross)}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">Não há preços específicos por máquina; aplicam-se os preços base dos produtos.</p>}
    </section>
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Histórico de preços</h2>
      {priceHistory?.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-[var(--line)] bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Âmbito</th><th className="px-4 py-3 text-right">Preço com IVA</th></tr></thead><tbody>{priceHistory.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-4 py-3">{new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(item.changed_at))}</td><td className="px-4 py-3">{item.products?.[0]?.name ?? "Produto"}</td><td className="px-4 py-3">{item.machines?.[0]?.name ?? "Preço base"}</td><td className="px-4 py-3 text-right">{euro.format(item.sale_price_gross)}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">As alterações de preço serão registadas aqui.</p>}
    </section>
  </main>;
}
