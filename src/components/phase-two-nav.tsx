"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryLinks = [
  ["/dashboard", "Painel"],
  ["/replenishments", "Máquinas"],
] as const;

const moreLinks = [
  ["/expenses", "Despesas"],
  ["/suppliers", "Fornecedores"],
  ["/products", "Produtos"],
  ["/purchases", "Compras"],
  ["/sales", "Histórico de vendas"],
  ["/stock", "Stocks"],
  ["/reports", "Relatórios"],
] as const;

export function PhaseTwoNav() {
  const pathname = usePathname();
  const moreIsActive = moreLinks.some(([href]) => pathname === href);
  const activeClass = "border-emerald-300 bg-emerald-100 text-emerald-900";
  const inactiveClass = "border-[var(--line)] bg-white text-slate-700 hover:border-emerald-200 hover:text-[var(--brand)]";

  return (
    <nav aria-label="Navegação principal" className="flex flex-wrap items-start gap-2 py-1">
      {primaryLinks.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${pathname === href ? activeClass : inactiveClass}`}>
          {label}
        </Link>
      ))}
      <details className="group relative">
        <summary aria-label="Mais categorias" className={`list-none cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition marker:hidden ${moreIsActive ? activeClass : inactiveClass}`}>
          Mais <span aria-hidden="true" className="ml-1 text-xs">▾</span>
        </summary>
        <div className="absolute left-0 top-full z-30 mt-2 flex w-52 flex-col gap-1 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-lg">
          {moreLinks.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`rounded-xl px-3 py-2 text-sm font-medium transition ${pathname === href ? activeClass : "text-slate-700 hover:bg-emerald-50 hover:text-[var(--brand)]"}`}>
              {label}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
