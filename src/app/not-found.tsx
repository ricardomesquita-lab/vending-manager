import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center px-5">
    <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-[var(--brand)]">VENDING MANAGER</p>
      <h1 className="mt-2 text-2xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">O endereço que procurou não existe.</p>
      <Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white">Voltar ao painel</Link>
    </div>
  </main>;
}
