"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function registerPurchase(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de registar compras.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode registar compras.";

  let lines: unknown;
  try { lines = JSON.parse(String(formData.get("lines_json") ?? "")); }
  catch { return "A lista de produtos da compra é inválida."; }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) return "Adicione entre um e cem produtos à compra.";
  const { data, error } = await supabase.rpc("register_purchase", {
    p_supplier_id: String(formData.get("supplier_id") ?? ""),
    p_invoice_number: `COMPRA-${randomUUID()}`,
    p_purchase_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    p_lines: lines,
  });
  if (error) return error.code === "23505" ? "Esta fatura já foi registada para este fornecedor." : "A compra não foi registada. Confirme fornecedor, linhas e migration da Fase 2.";
  if (!data) return "Não foi possível confirmar a compra.";
  revalidatePath("/purchases");
  revalidatePath("/stock");
  revalidatePath("/products");
  return null;
}
