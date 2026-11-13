"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getSignedInUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null, role: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, role: profile?.role ?? null };
}

export async function saveMachineSlot(formData: FormData): Promise<string | null> {
  const { supabase, user, role } = await getSignedInUser();
  if (!supabase) return "Configure a ligação ao Supabase antes de alterar posições.";
  if (!user) return "Inicie sessão para continuar.";
  if (role !== "administrator") return "Só um administrador pode associar produtos às posições.";

  const machineId = String(formData.get("machine_id") ?? "");
  const selectionCode = String(formData.get("selection_code") ?? "").trim();
  const slotId = String(formData.get("slot_id") ?? "");
  const newSelectionCode = String(formData.get("new_selection_code") ?? selectionCode).trim();
  const productId = String(formData.get("product_id") ?? "") || null;
  const capacity = Number(formData.get("capacity"));
  if (!machineId || !selectionCode || !newSelectionCode || !Number.isInteger(capacity) || capacity < 1) return "Indique um número de posição e capacidade válidos.";

  const { error } = slotId
    ? await supabase.from("machine_slots").update({ selection_code: newSelectionCode, product_id: productId, capacity }).eq("id", slotId).eq("machine_id", machineId)
    : await supabase.from("machine_slots").upsert({ machine_id: machineId, selection_code: newSelectionCode, product_id: productId, capacity }, { onConflict: "machine_id,selection_code" });
  if (error) return error.code === "23514" ? "Esvazie esta posição antes de trocar o produto ou reduzir a capacidade." : "Não foi possível guardar esta posição. Confirme se a migration das posições foi aplicada.";
  revalidatePath("/sales");
  revalidatePath("/replenishments");
  return null;
}

export async function registerMachineSlotSale(formData: FormData): Promise<string | null> {
  const { supabase, user, role } = await getSignedInUser();
  if (!supabase) return "Configure a ligação ao Supabase antes de registar vendas.";
  if (!user) return "Inicie sessão para continuar.";
  if (!role || !["administrator", "operator"].includes(role)) return "Não tem permissão para registar vendas.";

  let lines: unknown;
  try { lines = JSON.parse(String(formData.get("lines_json") ?? "")); }
  catch { return "A lista de posições da venda é inválida."; }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 35) return "Escolha pelo menos uma posição.";
  const { error } = await supabase.rpc("register_machine_slot_sale_and_replenish", {
    p_machine_id: String(formData.get("machine_id") ?? ""),
    p_sale_date: String(formData.get("sale_date") ?? ""),
    p_lines: lines,
    p_request_key: String(formData.get("request_key") ?? ""),
  });
  if (error) return error.code === "23514" ? "Stock insuficiente na máquina ou no armazém. A venda não foi registada." : "A venda não foi registada. Confirme as posições e se o caixa desse dia já foi fechado.";
  revalidatePath("/sales");
  revalidatePath("/replenishments");
  revalidatePath("/stock");
  revalidatePath("/cash");
  return null;
}

export async function replenishMachineSlot(formData: FormData): Promise<string | null> {
  const { supabase, user, role } = await getSignedInUser();
  if (!supabase) return "Configure a ligação ao Supabase antes de repor posições.";
  if (!user) return "Inicie sessão para continuar.";
  if (!role || !["administrator", "operator"].includes(role)) return "Não tem permissão para registar reposições.";

  const quantity = Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity < 1) return "Indique uma quantidade válida.";
  const { error } = await supabase.rpc("replenish_machine_slot", {
    p_slot_id: String(formData.get("slot_id") ?? ""),
    p_quantity: quantity,
    p_notes: String(formData.get("notes") ?? "").trim(),
    p_request_key: String(formData.get("request_key") ?? ""),
  });
  if (error) return error.code === "23514" ? "Confirme se há stock no armazém e espaço suficiente nesta posição." : "Não foi possível repor esta posição.";
  revalidatePath("/replenishments");
  revalidatePath("/stock");
  revalidatePath("/sales");
  return null;
}
