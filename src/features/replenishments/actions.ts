"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registerReplenishment(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de registar reposições.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["administrator", "operator"].includes(profile.role)) return "Não tem permissão para registar reposições.";
  let lines: unknown;
  try { lines = JSON.parse(String(formData.get("lines_json") ?? "")); }
  catch { return "A lista de produtos da reposição é inválida."; }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) return "Adicione entre um e cem produtos à reposição.";
  const { error } = await supabase.rpc("replenish_machine", {
    p_machine_id: String(formData.get("machine_id") ?? ""),
    p_lines: lines,
    p_notes: String(formData.get("notes") ?? "").trim(),
    p_request_key: String(formData.get("request_key") ?? ""),
  });
  if (error) return error.code === "23514" ? "O stock disponível no armazém é insuficiente." : "A reposição não foi concluída. Confirme máquina, quantidades e migration da Fase 2.";
  revalidatePath("/replenishments");
  revalidatePath("/stock");
  return null;
}
