"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const categories = ["electricity", "rent", "maintenance", "fuel_travel", "commissions", "consumables", "other"];

export async function registerExpense(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de registar despesas.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Apenas administradores podem registar despesas.";
  const category = String(formData.get("category") ?? "");
  const amount = Number(formData.get("amount_ex_vat"));
  const vat = Number(formData.get("vat_rate"));
  if (!categories.includes(category) || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(vat) || vat < 0 || vat > 100) return "Confirme a categoria, o valor e a taxa de IVA.";
  const { error } = await supabase.rpc("register_expense", {
    p_expense_date: String(formData.get("expense_date") ?? ""), p_category: category,
    p_description: String(formData.get("description") ?? "").trim(), p_amount_ex_vat: amount, p_vat_rate: vat,
    p_machine_id: String(formData.get("machine_id") ?? "") || null,
    p_supplier_id: String(formData.get("supplier_id") ?? "") || null,
  });
  if (error) return "A despesa não foi registada. Confirme os dados e as migrations aplicadas.";
  revalidatePath("/expenses"); revalidatePath("/reports"); revalidatePath("/dashboard");
  return null;
}
