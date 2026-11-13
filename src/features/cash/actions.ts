"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function verifyCashRole() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, error: "Configure a ligação ao Supabase antes de registar operações de caixa." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Inicie sessão para continuar." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["administrator", "operator"].includes(profile.role)) return { supabase: null, error: "Não tem permissão para gerir caixa." };
  return { supabase, error: null };
}

export async function recordCashOperation(formData: FormData): Promise<string | null> {
  const { supabase, error } = await verifyCashRole();
  if (!supabase) return error;
  const operationType = String(formData.get("operation_type") ?? "");
  if (!["collection", "float_reinforcement", "withdrawal"].includes(operationType)) return "Escolha um tipo de operação válido.";
  const { error: rpcError } = await supabase.rpc("record_cash_operation", {
    p_machine_id: String(formData.get("machine_id") ?? ""),
    p_operation_date: String(formData.get("operation_date") ?? ""),
    p_operation_type: operationType,
    p_amount: Number(formData.get("amount")),
    p_notes: String(formData.get("notes") ?? "").trim(),
    p_request_key: String(formData.get("request_key") ?? ""),
  });
  if (rpcError) return "A operação não foi registada. Confirme a data, máquina e valor.";
  revalidatePath("/cash");
  revalidatePath("/replenishments");
  return null;
}

