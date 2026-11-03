"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const supabase = createClient();
    if (!supabase) {
      setError("A aplicação ainda não está ligada ao Supabase. Configure o ficheiro .env.local.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Não foi possível iniciar sessão. Verifique o email e a palavra-passe.");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={submit}>
      <label className="block text-sm font-medium">Email
        <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-4 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-emerald-100" />
      </label>
      <label className="block text-sm font-medium">Palavra-passe
        <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-4 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-emerald-100" />
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={loading} className="h-12 w-full rounded-xl bg-[var(--brand)] font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60">{loading ? "A entrar…" : "Entrar"}</button>
      <p className="text-center text-xs text-[var(--muted)]">O acesso é criado pelo administrador da aplicação.</p>
    </form>
  );
}
