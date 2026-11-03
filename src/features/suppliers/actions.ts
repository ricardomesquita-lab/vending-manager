"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSupplier(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de criar fornecedores.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode criar fornecedores.";
  const name = String(formData.get("name") ?? "").trim();
  const supplierCode = String(formData.get("supplier_code") ?? "").trim();
  if (!name || !supplierCode) return "O nome e o código do fornecedor são obrigatórios.";
  const { error } = await supabase.from("suppliers").insert({
    name,
    supplier_code: supplierCode,
  });
  if (error) return error.code === "23505" ? "Já existe um fornecedor com esse código." : "Não foi possível guardar o fornecedor. Confirme se aplicou a migration do código de fornecedor.";
  revalidatePath("/suppliers");
  revalidatePath("/products");
  return null;
}

export async function updateSupplier(id: string, formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de editar fornecedores.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode editar fornecedores.";
  const name = String(formData.get("name") ?? "").trim();
  const supplierCode = String(formData.get("supplier_code") ?? "").trim();
  if (!id || !name || !supplierCode) return "O nome e o código do fornecedor são obrigatórios.";
  const { error } = await supabase.from("suppliers").update({ name, supplier_code: supplierCode }).eq("id", id);
  if (error) return error.code === "23505" ? "Já existe um fornecedor com esse código." : "Não foi possível atualizar o fornecedor.";
  revalidatePath("/suppliers");
  revalidatePath("/products");
  revalidatePath("/purchases");
  revalidatePath("/expenses");
  return null;
}
