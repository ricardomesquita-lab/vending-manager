"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registerSale(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de registar vendas.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["administrator", "operator"].includes(profile.role)) return "Não tem permissão para registar vendas.";
  let lines: unknown;
  try { lines = JSON.parse(String(formData.get("lines_json") ?? "")); }
  catch { return "A lista de produtos da venda é inválida."; }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) return "Adicione entre um e cem produtos à venda.";
  const { error } = await supabase.rpc("register_sale", {
    p_machine_id: String(formData.get("machine_id") ?? ""),
    p_sale_date: String(formData.get("sale_date") ?? ""),
    p_lines: lines,
    p_request_key: String(formData.get("request_key") ?? ""),
  });
  if (error) return error.code === "23514" ? "O stock disponível na máquina é insuficiente." : "A venda não foi registada. Confirme os dados e se o caixa desse dia já foi fechado.";
  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/cash");
  return null;
}

export async function voidSale(saleId: string, reason: string): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de anular vendas.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode anular vendas.";
  const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId, p_reason: reason.trim() });
  if (error) return "A venda não foi anulada. Confirme se ainda está ativa e indique uma justificação.";
  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/cash");
  return null;
}
