"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registerInventoryCount(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de registar inventários.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["administrator", "operator"].includes(profile.role)) return "Não tem permissão para registar inventários.";
  const scope = String(formData.get("scope") ?? "");
  if (scope !== "warehouse" && scope !== "machine") return "Escolha o local do inventário.";
  let lines: unknown;
  try { lines = JSON.parse(String(formData.get("lines_json") ?? "")); }
  catch { return "A lista de contagens é inválida."; }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) return "Adicione entre um e cem produtos ao inventário.";
  const { error } = await supabase.rpc("record_inventory_count", {
    p_scope: scope,
    p_machine_id: scope === "machine" ? String(formData.get("machine_id") ?? "") : null,
    p_justification: String(formData.get("justification") ?? "").trim(),
    p_lines: lines,
  });
  if (error) return "O inventário não foi confirmado. Confirme o local, contagens e justificação.";
  revalidatePath("/inventory");
  revalidatePath("/stock");
  return null;
}

export async function approveInventoryCount(countId: string): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de autorizar correções.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode autorizar correções de stock.";
  const { error } = await supabase.rpc("approve_inventory_count", { p_count_id: countId });
  if (error) return "A correção não foi aplicada. O stock pode ter mudado desde a contagem; confirme os movimentos mais recentes.";
  revalidatePath("/inventory");
  revalidatePath("/stock");
  return null;
}
