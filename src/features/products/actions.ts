"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function createProduct(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de criar produtos.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode criar produtos.";

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");
  const salePrice = Number(formData.get("sale_price_gross"));
  const vatRate = Number(formData.get("vat_rate"));
  const averageCost = Number(formData.get("average_cost_ex_vat") ?? 0);
  const warehouseMinimum = Number(formData.get("warehouse_minimum") ?? 0);
  const machineMinimum = Number(formData.get("machine_minimum") ?? 0);
  if (!name || !categoryId || !Number.isFinite(salePrice) || salePrice < 0 || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100 || !Number.isFinite(averageCost) || averageCost < 0 || !Number.isInteger(warehouseMinimum) || warehouseMinimum < 0 || !Number.isInteger(machineMinimum) || machineMinimum < 0) {
    return "Verifique o nome, categoria, preços, IVA e stocks mínimos.";
  }

  const { error } = await supabase.from("products").insert({
    internal_code: `AUTO-${randomUUID()}`,
    barcode: String(formData.get("barcode") ?? "").trim() || null,
    name,
    category_id: categoryId,
    description: String(formData.get("description") ?? "").trim(),
    preferred_supplier_id: String(formData.get("preferred_supplier_id") ?? "") || null,
    average_cost_ex_vat: averageCost,
    vat_rate: vatRate,
    sale_price_gross: salePrice,
    warehouse_minimum: warehouseMinimum,
    machine_minimum: machineMinimum,
  });
  if (error) return error.code === "23505" ? "Já existe um produto com esse código de barras." : "Não foi possível guardar o produto. Confirme os dados e a migration da Fase 2.";
  revalidatePath("/products");
  revalidatePath("/stock");
  return null;
}

export async function updateProduct(productId: string, formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de editar produtos.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode editar produtos.";
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");
  const salePrice = Number(formData.get("sale_price_gross"));
  const vatRate = Number(formData.get("vat_rate"));
  const warehouseMinimum = Number(formData.get("warehouse_minimum"));
  const machineMinimum = Number(formData.get("machine_minimum"));
  if (!name || !categoryId || !Number.isFinite(salePrice) || salePrice < 0 || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100 || !Number.isInteger(warehouseMinimum) || warehouseMinimum < 0 || !Number.isInteger(machineMinimum) || machineMinimum < 0) {
    return "Verifique o nome, categoria, preço, IVA e stocks mínimos.";
  }
  const { error } = await supabase.from("products").update({
    barcode: String(formData.get("barcode") ?? "").trim() || null,
    name,
    category_id: categoryId,
    description: String(formData.get("description") ?? "").trim(),
    preferred_supplier_id: String(formData.get("preferred_supplier_id") ?? "") || null,
    vat_rate: vatRate,
    sale_price_gross: salePrice,
    warehouse_minimum: warehouseMinimum,
    machine_minimum: machineMinimum,
    active: formData.get("active") === "on",
  }).eq("id", productId);
  if (error) return error.code === "23505" ? "Já existe outro produto com esse código ou código de barras." : "Não foi possível atualizar o produto.";
  revalidatePath("/products");
  revalidatePath("/purchases");
  revalidatePath("/stock");
  return null;
}

export async function setMachinePrice(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return "Configure a ligação ao Supabase antes de definir preços por máquina.";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Inicie sessão para continuar.";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return "Só um administrador pode alterar preços.";
  const machineId = String(formData.get("machine_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const price = Number(formData.get("sale_price_gross"));
  if (!machineId || !productId || !Number.isFinite(price) || price < 0) return "Escolha uma máquina, um produto e um preço válido.";
  const { error } = await supabase.from("machine_product_prices").upsert({ machine_id: machineId, product_id: productId, sale_price_gross: price }, { onConflict: "machine_id,product_id" });
  if (error) return "Não foi possível guardar o preço por máquina.";
  revalidatePath("/products");
  return null;
}
