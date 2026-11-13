import { ProductThumbnail } from "@/components/product-thumbnail";
import { ApproveCountButton } from "@/features/inventory/approve-count-button";
import { InventoryForm } from "@/features/inventory/inventory-form";
import { machinePanelClasses, machinePanelHeadingClasses } from "@/features/machines/machine-panel-colors";

type ProductChoice = { id: string; name: string; image_url: string | null };
type MachineChoice = { id: string; name: string; code: string };
type InventoryCount = {
  id: string;
  scope: string;
  status: string;
  machine_id: string | null;
  justification: string;
  created_at: string;
  machines: { name: string; code: string }[] | null;
  profiles: { full_name: string | null }[] | null;
  inventory_count_lines: {
    product_id: string;
    quantity_before: number;
    quantity_counted: number;
    quantity_difference: number;
    products: { name: string; image_url: string | null }[] | null;
  }[];
};

const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" });

export function InventorySection({ products, machines, counts, isAdmin, error }: { products: ProductChoice[]; machines: MachineChoice[]; counts: InventoryCount[]; isAdmin: boolean; error: boolean }) {
  return <details id="contagens" className="mt-8 rounded-2xl border border-[var(--line)] bg-slate-50 p-4 sm:p-5">
    <summary className="cursor-pointer text-lg font-semibold">Contagens físicas e correções de stock</summary>
    <div className="mt-4">
      <h3 className="mb-3 font-semibold">Nova contagem física</h3>
      <InventoryForm products={products} machines={machines} />
    </div>
    <section className="mt-6">
      <h3 className="mb-3 font-semibold">Histórico de contagens</h3>
      {error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Não foi possível carregar as contagens. Confirme se as migrations foram aplicadas.</p> : counts.length ? <div className="space-y-3">{counts.map((count) => {
        const code = count.scope === "machine" ? count.machines?.[0]?.code : undefined;
        const dark = code === "M3";
        return <article key={count.id} className={`rounded-2xl border p-5 ${count.scope === "machine" ? machinePanelClasses(code) : "border-[var(--line)] bg-white"} ${dark ? "text-white" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h4 className={`font-semibold ${machinePanelHeadingClasses(code)}`}>{count.scope === "warehouse" ? "Armazém" : count.machines?.[0]?.name ?? "Máquina"}</h4><div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs ${count.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{count.status === "confirmed" ? "Correção autorizada" : "Pendente de autorização"}</span><time className={`text-sm ${dark ? "text-neutral-300" : "text-[var(--muted)]"}`}>{dateFormat.format(new Date(count.created_at))}</time></div></div>
          <p className={`mt-1 text-xs ${dark ? "text-neutral-300" : "text-[var(--muted)]"}`}>Contagem por {count.profiles?.[0]?.full_name || "utilizador"}</p>
          <ul className="mt-3 space-y-1 text-sm">{count.inventory_count_lines.map((line) => <li key={line.product_id} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><ProductThumbnail imageUrl={line.products?.[0]?.image_url} name={line.products?.[0]?.name ?? "Produto"} size="xs" />{line.products?.[0]?.name ?? "Produto"}</span><span className="shrink-0">{line.quantity_before} → {line.quantity_counted} <strong className={line.quantity_difference === 0 ? "text-emerald-700" : "text-amber-700"}>({line.quantity_difference > 0 ? "+" : ""}{line.quantity_difference})</strong></span></li>)}</ul>
          <p className={`mt-3 text-sm ${dark ? "text-neutral-300" : "text-slate-600"}`}>{count.justification}</p>
          {isAdmin && count.status === "pending_approval" && <ApproveCountButton countId={count.id} />}
        </article>;
      })}</div> : <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">Ainda não há contagens registadas.</p>}
    </section>
  </details>;
}
