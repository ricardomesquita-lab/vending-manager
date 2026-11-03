import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { SupplierForm } from "@/features/suppliers/supplier-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: suppliers, error }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("suppliers").select("id,name,supplier_code").order("name"),
  ]);
  const isAdmin = profile?.role === "administrator";

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Fornecedores</h1></header>
    <PhaseTwoNav />
    {isAdmin && <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Novo fornecedor</h2><SupplierForm /></section>}
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Lista de fornecedores</h2>
      {error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar os fornecedores. Confirme se aplicou a migration do código de fornecedor.</p> : suppliers?.length ? <div className="grid gap-3 sm:grid-cols-2">{suppliers.map((supplier) => <article key={supplier.id} className="rounded-2xl border border-[var(--line)] bg-white p-5"><div><h3 className="font-semibold">{supplier.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">Código: {supplier.supplier_code || "Por preencher"}</p></div>{isAdmin && <details className="mt-3"><summary className="w-fit cursor-pointer text-sm font-medium text-[var(--brand)]">Editar nome ou código</summary><div className="mt-3"><SupplierForm supplier={supplier} /></div></details>}</article>)}</div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">Ainda não há fornecedores registados.</p>}
    </section>
  </main>;
}
