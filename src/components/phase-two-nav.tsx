"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="-mx-1 flex gap-2 overflow-x-auto py-1">
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${pathname === href ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-[var(--line)] bg-white text-slate-700 hover:border-emerald-200 hover:text-[var(--brand)]"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
