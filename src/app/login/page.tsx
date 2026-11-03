import { LoginForm } from "@/features/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-bold text-[var(--brand)]">V</div>
          <div><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><p className="text-sm text-[var(--muted)]">Gestão do seu espaço</p></div>
        </div>
        <h1 className="text-2xl font-semibold">Iniciar sessão</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Aceda à gestão das máquinas, produtos e operações.</p>
        <LoginForm />
      </section>
    </main>
  );
}
