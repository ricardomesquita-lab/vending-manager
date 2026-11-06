"use client";

import { useState } from "react";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { createProduct, updateProduct } from "@/features/products/actions";

type Choice = { id: string; name: string };
type ExistingProduct = { id: string; name: string; category_id: string; description: string; preferred_supplier_id: string | null; vat_rate: number; sale_price_gross: number; average_cost_ex_vat: number; warehouse_minimum: number; machine_minimum: number; active: boolean; image_url?: string | null };

async function compressProductImage(file: File): Promise<File> {
  if (file.size > 20 * 1024 * 1024) throw new Error("A foto original não pode exceder 20 MB.");
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto neste dispositivo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível preparar a foto.")), "image/jpeg", 0.82));
  if (blob.size > 3 * 1024 * 1024) throw new Error("A foto continua demasiado grande depois da otimização. Escolha outra imagem.");
  const baseName = file.name.replace(/\.[^.]+$/, "") || "produto";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export function ProductForm({ categories, suppliers, product }: { categories: Choice[]; suppliers: Choice[]; product?: ExistingProduct }) {
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault(); setError(""); const formData = new FormData(event.currentTarget); setPending(true);
      void (async () => {
        try {
          const photo = formData.get("product_image");
          if (photo instanceof File && photo.size > 0) formData.set("product_image", await compressProductImage(photo));
          const result = product ? await updateProduct(product.id, formData) : await createProduct(formData);
          if (result) setError(result); else window.location.reload();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Não foi possível guardar o produto.");
        } finally {
          setPending(false);
        }
      })();
    }}>
      <label className="text-sm font-medium">Nome<input name="name" required maxLength={150} defaultValue={product?.name} className="field" /></label>
      <label className="text-sm font-medium">Foto do produto (opcional)<input name="product_image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; setPhotoPreview(file ? URL.createObjectURL(file) : null); }} className="field file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2" /><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Escolha uma foto do computador ou telemóvel. A imagem é otimizada automaticamente antes de guardar.{product?.image_url ? " Já existe uma foto; só será substituída se escolher outra." : ""}</span>{(photoPreview || product?.image_url) && <span className="mt-2 flex items-center gap-2"><ProductThumbnail imageUrl={photoPreview ?? product?.image_url} name={product?.name ?? "Novo produto"} size="md" /><span className="text-xs font-normal">Pré-visualização da foto</span></span>}</label>
      <label className="text-sm font-medium">Categoria<select name="category_id" required defaultValue={product?.category_id ?? ""} className="field"><option value="" disabled>Escolher categoria</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-medium">Fornecedor preferencial<select name="preferred_supplier_id" defaultValue={product?.preferred_supplier_id ?? ""} className="field"><option value="">Sem fornecedor definido</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {!product && <label className="text-sm font-medium">Custo inicial sem IVA (€)<input name="average_cost_ex_vat" type="number" min="0" step="0.0001" defaultValue="0" required className="field" /></label>}
      {product && <p className="text-sm text-[var(--muted)]">Custo médio atual: {product.average_cost_ex_vat.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} € · Atualizado pelas compras.</p>}
      <label className="text-sm font-medium">IVA (%)<input name="vat_rate" type="number" min="0" max="100" step="0.01" defaultValue={product?.vat_rate ?? 23} required className="field" /></label>
      <label className="text-sm font-medium">Preço de venda com IVA (€)<input name="sale_price_gross" type="number" min="0" step="0.01" defaultValue={product?.sale_price_gross} required className="field" /></label>
      <label className="text-sm font-medium">Stock mínimo no armazém<input name="warehouse_minimum" type="number" min="0" step="1" defaultValue={product?.warehouse_minimum ?? 0} required className="field" /></label>
      <label className="text-sm font-medium">Stock mínimo por máquina<input name="machine_minimum" type="number" min="0" step="1" defaultValue={product?.machine_minimum ?? 0} required className="field" /></label>
      <label className="text-sm font-medium sm:col-span-2">Descrição (opcional)<textarea name="description" rows={2} maxLength={1000} defaultValue={product?.description ?? ""} className="field h-auto py-3" /></label>
      {product && <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={product.active} className="h-4 w-4 accent-[var(--brand)]" /> Produto ativo</label>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><button disabled={pending || categories.length === 0} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A guardar…" : product ? "Guardar alterações" : "Criar produto"}</button></div>
    </form>
  );
}
