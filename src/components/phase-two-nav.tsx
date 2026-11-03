import Link from "next/link";

const links = [
  ["/dashboard", "Painel"],
  ["/products", "Produtos"],
  ["/suppliers", "Fornecedores"],
  ["/purchases", "Compras"],
  ["/sales", "Vendas"],
  ["/cash", "Caixa"],
  ["/stock", "Stocks"],
  ["/replenishments", "Reposições"],
  ["/inventory", "Inventários"],
  ["/expenses", "Despesas"],
  ["/reports", "Relatórios"],
] as const;

export function PhaseTwoNav() {
  return (
    <nav aria-label="Navegação principal" className="-mx-1 flex gap-2 overflow-x-auto py-1">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="shrink-0 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:text-[var(--brand)]">
          {label}
        </Link>
      ))}
    </nav>
  );
}
