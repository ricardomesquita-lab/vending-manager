"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { registerMachineSlotSale, replenishMachineSlot, saveMachineSlot } from "@/features/machines/actions";

export type MachineSlot = {
  id: string;
  machine_id: string;
  selection_code: string;
  product_id: string | null;
  quantity: number;
  capacity: number;
  active: boolean;
  product: { id: string; name: string; sale_price_gross: number; active: boolean; image_url?: string | null } | null;
  price: number | null;
};
export type SlotProduct = { id: string; name: string; sale_price_gross: number; active: boolean; image_url?: string | null; warehouse_quantity?: number };
type Mode = "sale" | "replenishment";
type BasketLine = { slot_id: string; product_id: string; name: string; image_url?: string | null; selection_code: string; quantity: number; unit_price: number };
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const layouts: Record<string, string[][]> = {
  M1: [["21", "22", "23", "24", "25", "26"], ["41", "43", "44", "45"], ["51", "52", "53", "54", "55", "56"]],
  M2: [["11", "13", "15", "17"], ["21", "22", "23", "24", "25", "26"], ["31", "33", "35", "37"], ["41", "43", "45", "47"], ["51", "52", "53", "54", "55", "56", "57", "58"], ["61", "62", "63", "64", "65", "66", "67"]],
  M3: [["11", "12", "13"], ["21", "22", "23", "24", "25", "26"], ["31", "32", "33", "34", "35", "36"], ["41", "42", "43", "44", "45", "46"], ["51", "52", "53", "54", "55", "56"], ["61", "62", "63", "64", "65"]],
};

export function MachineSlotMap({
  machineId,
  machineCode,
  slots,
  products,
  mode,
  isAdmin = false,
  saleDate,
}: {
  machineId: string;
  machineCode: string;
  slots: MachineSlot[];
  products: SlotProduct[];
  mode: Mode;
  isAdmin?: boolean;
  saleDate?: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [capacity, setCapacity] = useState("10");
  const [productId, setProductId] = useState("");
  const [slotCode, setSlotCode] = useState("");
  const [saleDay, setSaleDay] = useState(saleDate || localToday());
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const lastSaleTap = useRef<{ slotId: string; time: number } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const slotsWithProducts = useMemo(() => slots.map((slot) => {
    const fallbackProduct = products.find((product) => product.id === slot.product_id) ?? null;
    const linkedProduct = slot.product;
    return {
      ...slot,
      product: linkedProduct
        ? { ...fallbackProduct, ...linkedProduct, image_url: linkedProduct.image_url ?? fallbackProduct?.image_url ?? null }
        : fallbackProduct,
    };
  }), [slots, products]);
  const slotByCode = useMemo(() => new Map(slotsWithProducts.map((slot) => [slot.selection_code, slot])), [slotsWithProducts]);
  const shelfCodes = layouts[machineCode] ?? [];
  const shelfRows = shelfCodes.map((codes) => codes.map((code) => slotByCode.get(code) ?? null));
  const visibleCodes = new Set(shelfCodes.flat());
  const extraSlots = slotsWithProducts.filter((slot) => !visibleCodes.has(slot.selection_code));
  const visibleSlots = shelfRows.flatMap((row) => row).filter((slot): slot is MachineSlot => Boolean(slot));
  const selected = slotsWithProducts.find((slot) => slot.id === selectedId) ?? null;
  const configured = visibleSlots.filter((slot) => slot.active && (mode === "sale" ? Boolean(slot.product?.image_url) : Boolean(slot.product_id))).length;
  const totalQuantity = visibleSlots.reduce((sum, slot) => sum + slot.quantity, 0);
  const positionCount = shelfCodes.reduce((sum, row) => sum + row.length, 0);

  function submit(action: (formData: FormData) => Promise<string | null>, values: Record<string, string>, success: string) {
    setError(""); setNotice("");
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) formData.set(key, value);
    startTransition(() => { void (async () => {
      try {
        const result = await action(formData);
        if (result) setError(result);
        else if (mode === "sale") { setBasket([]); setNotice(success); router.refresh(); }
        else { setNotice(success); window.location.reload(); }
      } catch { setError("Não foi possível guardar a operação. Verifique a ligação e tente novamente."); }
    })(); });
  }

  function addSaleTap(slot: (typeof slotsWithProducts)[number], tapTime: number) {
    if (!slot.product?.image_url || !slot.product_id) return;
    const currentLine = basket.find((line) => line.slot_id === slot.id);
    const previousTap = lastSaleTap.current;
    if (previousTap?.slotId === slot.id && tapTime - previousTap.time <= 650) {
      lastSaleTap.current = null;
      if (!currentLine) return;
      setError("");
      setBasket((current) => current.flatMap((line) => line.slot_id !== slot.id ? [line] : line.quantity > 2 ? [{ ...line, quantity: line.quantity - 2 }] : []));
      setNotice(`Toque duplo: total da posição ${slot.selection_code} reduzido em uma unidade.`);
      return;
    }
    lastSaleTap.current = { slotId: slot.id, time: tapTime };
    const soldSoFar = currentLine?.quantity ?? 0;
    const warehouseQuantity = products.find((item) => item.id === slot.product_id)?.warehouse_quantity ?? 0;
    if (basket.some((line) => line.product_id === slot.product_id && line.slot_id !== slot.id)) { setError("Este produto aparece em mais de uma posição. Regista uma posição de cada vez."); return; }
    if (soldSoFar >= slot.quantity) { setError(`A posição ${slot.selection_code} não tem mais unidades para registar.`); return; }
    if (soldSoFar >= warehouseQuantity) { setError(`O armazém não tem stock suficiente para repor a posição ${slot.selection_code}.`); return; }
    setError("");
    setBasket((current) => {
      const existing = current.find((line) => line.slot_id === slot.id);
      if (!existing) return [...current, { slot_id: slot.id, product_id: slot.product_id!, name: slot.product!.name, image_url: slot.product!.image_url, selection_code: slot.selection_code, quantity: 1, unit_price: slot.price ?? slot.product!.sale_price_gross }];
      return current.map((line) => line.slot_id === slot.id ? { ...line, quantity: line.quantity + 1 } : line);
    });
    setNotice(`Posição ${slot.selection_code}: ${soldSoFar + 1} unidade(s) para validar.`);
  }

  function finishSale() {
    if (!basket.length) { setError("Escolha pelo menos um produto na máquina."); return; }
    submit(registerMachineSlotSale, {
      machine_id: machineId,
      sale_date: saleDay,
      request_key: crypto.randomUUID(),
      lines_json: JSON.stringify(basket.map(({ slot_id, quantity }) => ({ slot_id, quantity }))),
    }, "Venda registada e quantidade reposta automaticamente.");
  }

  function refill() {
    if (!selected) return;
    submit(replenishMachineSlot, {
      slot_id: selected.id,
      quantity,
      request_key: crypto.randomUUID(),
      notes: `Reposição na posição ${selected.selection_code}`,
    }, `Posição ${selected.selection_code} reposta.`);
  }

  function saveAssignment() {
    if (!selected) return;
    submit(saveMachineSlot, {
      machine_id: machineId,
      selection_code: selected.selection_code,
      slot_id: selected.id,
      new_selection_code: slotCode,
      product_id: productId,
      capacity,
    }, `Posição ${selected.selection_code} guardada.`);
  }

  const availableToRefill = selected?.product_id ? products.find((item) => item.id === selected.product_id)?.warehouse_quantity ?? 0 : 0;
  const assignmentPreview = products.find((item) => item.id === productId) ?? null;
  const maxToRefill = selected ? Math.max(0, Math.min(availableToRefill, selected.capacity - selected.quantity)) : 0;
  const machineBackground = machineCode === "M3"
    ? "border-neutral-800 bg-neutral-950"
    : machineCode === "M2"
      ? "border-[#743b40] bg-[#9b5b52]"
      : "border-violet-200 bg-violet-100";

  return <section className="space-y-4">
    <div className="grid items-start gap-4">
      <div className={`mx-auto w-full max-w-[660px] space-y-3 rounded-2xl border p-3 sm:p-5 ${machineBackground}`}>
        <div className="rounded-xl bg-slate-800 px-4 py-3 text-center text-lg font-semibold tracking-wide text-white sm:text-xl">MÁQUINA {machineCode === "M1" ? "CAFÉ" : machineCode === "M3" ? "PRETA" : "CASTANHA"}</div>
        {shelfRows.map((row, rowIndex) => <div key={rowIndex} className="rounded-xl border-2 border-slate-300 bg-white p-2">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prateleira {rowIndex + 1}</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
        {row.map((slot, slotIndex) => {
          const code = shelfCodes[rowIndex][slotIndex];
          const configuredSlot = Boolean(slot && slot.active && (mode === "sale" ? slot.product?.image_url : slot.product_id));
          const stocked = Boolean(configuredSlot && slot && slot.quantity > 0);
          const low = Boolean(configuredSlot && slot && slot.quantity > 0 && slot.quantity <= 2);
          const isSelected = slot?.id === selectedId;
          const saleLine = slot ? basket.find((line) => line.slot_id === slot.id) : null;
          return <button
            key={slot?.id ?? `${rowIndex}-${code}`}
            type="button"
            onClick={(event) => { if (!slot) return; if (mode === "sale") { addSaleTap(slot, event.timeStamp); return; } setSelectedId(slot.id); setProductId(slot.product_id ?? ""); setSlotCode(slot.selection_code); setCapacity(String(slot.capacity)); setQuantity("1"); setError(""); setNotice(""); }}
            disabled={!slot || (mode === "sale" && (!slot.active || !slot.product?.image_url))}
            aria-label={`Posição ${code}${slot?.product ? `, ${slot.product.name}, ${slot.quantity} unidades` : ", sem produto associado"}`}
            title={`${code}${slot?.product ? ` · ${slot.product.name} · ${slot.quantity} un.` : " · por configurar"}`}
            className={`flex min-h-[96px] flex-col items-center justify-between rounded-lg border p-1 text-center transition focus:outline-none focus:ring-2 focus:ring-emerald-600 sm:min-h-[112px] ${isSelected ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-600" : low ? "border-amber-300 bg-amber-50" : stocked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
          >{slot?.product?.image_url ? <img src={slot.product.image_url} alt="" className="h-[68px] w-full min-w-0 flex-1 object-contain sm:h-[80px]" /> : <span className="flex h-12 w-12 max-w-full items-center justify-center rounded-md bg-slate-200 text-lg text-slate-500">＋</span>}{slot?.product && <span className="text-[9px] font-medium text-slate-500">{slot.quantity}/{slot.capacity}</span>}<span className="text-xs font-bold text-slate-800">{code}</span>{mode === "sale" ? <span className="min-h-[12px] text-[9px] font-semibold text-emerald-800">{saleLine ? `Venda: ${saleLine.quantity}` : slot?.product?.image_url ? "Toque para vender" : "Sem foto"}</span> : slot?.product?.image_url ? null : <span className="line-clamp-2 text-[9px] leading-tight text-slate-600">{slot?.product?.name ?? "Livre"}</span>}</button>;
        })}
          </div>
        </div>)}
        <div className="rounded-lg bg-slate-800 px-4 py-3 text-center text-xs font-semibold text-white">RECOLHA DO PRODUTO</div>
      </div>
      {extraSlots.length > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Há posições antigas fora desta numeração ({extraSlots.map((slot) => slot.selection_code).join(", ")}). Foram mantidas para não perder stock ou histórico.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Posições configuradas</p><p className="mt-1 text-xl font-semibold">{configured} <span className="text-sm font-normal text-[var(--muted)]">/ {positionCount}</span></p></article>
        <article className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Unidades na máquina</p><p className="mt-1 text-xl font-semibold">{totalQuantity}</p></article>
        <article className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Como usar</p><p className="mt-1 text-sm">{mode === "sale" ? "Um toque soma 1. Toque duas vezes rapidamente para reduzir o total em 1. Valide quando quiser." : "Toque numa posição para ver ou atualizar."}</p></article>
      </div>

      {mode === "replenishment" && <aside className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5">
        {!selected ? <div><h3 className="font-semibold">Escolha uma posição</h3><p className="mt-2 text-sm text-[var(--muted)]">Toque numa posição do esquema para ver o produto e atualizar o stock.</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">Verde: stock disponível</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">Amarelo: pouco stock</span><span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-800">Cinzento: sem produto ou sem stock</span></div>{!slotsWithProducts.length && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">As posições ainda não foram criadas. Aplique a migration de posições da máquina.</p>}</div> : <>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Posição {selected.selection_code}</p><h3 className="mt-1 flex items-center gap-2 text-lg font-semibold"><ProductThumbnail imageUrl={selected.product?.image_url} name={selected.product?.name ?? "Produto"} size="sm" />{selected.product?.name ?? "Sem produto associado"}</h3></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Fechar posição" className="rounded-lg border border-[var(--line)] px-3 py-1 text-sm">Fechar</button></div>
          {isAdmin && mode === "replenishment" && assignmentPreview && <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><ProductThumbnail imageUrl={assignmentPreview.image_url} name={assignmentPreview.name} size="sm" /><span className="text-sm font-medium">{assignmentPreview.name}</span></div>}

          {selected.product_id && selected.product ? <>
            {isAdmin && mode === "replenishment" && <label className="block text-sm font-medium">Número da posição<input value={slotCode} onChange={(event) => setSlotCode(event.target.value)} maxLength={12} className="field" /></label>}
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4"><div><p className="text-xs text-[var(--muted)]">Na posição</p><p className="mt-1 text-2xl font-semibold">{selected.quantity}<span className="ml-1 text-sm font-normal">un.</span></p></div><div><p className="text-xs text-[var(--muted)]">Capacidade</p><p className="mt-1 text-2xl font-semibold">{selected.capacity}<span className="ml-1 text-sm font-normal">un.</span></p></div></div>
              <p className="text-sm text-[var(--muted)]">Stock no armazém: <strong className="text-[var(--foreground)]">{availableToRefill} un.</strong></p>
              <label className="block text-sm font-medium">Quantidade a repor<input type="number" min="1" max={maxToRefill || undefined} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={!maxToRefill} className="field" /></label>
              <button type="button" disabled={pending || maxToRefill < 1} onClick={refill} className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A repor…" : "Repor esta posição"}</button>
              {maxToRefill < 1 && <p className="text-sm text-amber-800">Não há stock no armazém ou espaço livre nesta posição.</p>}
            {isAdmin && mode === "replenishment" && selected.quantity === 0 && <details className="rounded-xl border border-[var(--line)] p-3"><summary className="cursor-pointer text-sm font-medium">Alterar produto ou capacidade</summary><div className="mt-3 space-y-3"><label className="block text-sm font-medium">Produto<select value={productId} onChange={(event) => setProductId(event.target.value)} className="field"><option value="">Sem produto</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm font-medium">Capacidade<input type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="field" /></label><button type="button" disabled={pending || !productId} onClick={saveAssignment} className="w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Guardar posição</button></div></details>}
          </> : isAdmin && mode === "replenishment" ? <>
            <label className="block text-sm font-medium">Número da posição<input value={slotCode} onChange={(event) => setSlotCode(event.target.value)} maxLength={12} className="field" /></label>
            <p className="text-sm text-[var(--muted)]">Associe um produto a esta posição. Depois poderá repor stock a partir do armazém.</p>
            <label className="block text-sm font-medium">Produto<select value={productId} onChange={(event) => setProductId(event.target.value)} className="field"><option value="">Escolher produto</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="block text-sm font-medium">Capacidade<input type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="field" /></label>
            <button type="button" disabled={pending || !productId} onClick={saveAssignment} className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Guardar produto nesta posição</button>
            {!products.length && <p className="text-sm text-amber-800">Crie primeiro um produto no catálogo.</p>}
          </> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Esta posição ainda está por configurar. Peça a um administrador para associar um produto.</p>}
        </>}

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && !pending && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      </aside>}
    </div>

    {mode === "sale" && <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Vendas por validar</h3><p className="text-sm text-[var(--muted)]">Um toque soma uma unidade; dois toques rápidos reduzem o total em uma. Podes validar em qualquer momento.</p></div><label className="text-sm font-medium">Data<input type="date" value={saleDay} onChange={(event) => setSaleDay(event.target.value)} className="field" /></label></div>
      {basket.length ? <ul className="space-y-2">{basket.map((line) => <li key={line.slot_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><span className="flex items-center gap-2 text-sm"><ProductThumbnail imageUrl={line.image_url} name={line.name} size="xs" /><span><strong>{line.selection_code}</strong> · {line.name} · {line.quantity} un.</span></span><strong className="text-sm">{euro.format(line.unit_price * line.quantity)}</strong></li>)}</ul> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-[var(--muted)]">Ainda não registaste nenhuma venda. Toca na fotografia do produto na posição correspondente.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && !pending && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"><p className="text-sm">Total estimado <strong className="ml-2 text-lg">{euro.format(basket.reduce((sum, line) => sum + line.unit_price * line.quantity, 0))}</strong></p><button type="button" disabled={pending || basket.length === 0} onClick={finishSale} className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A registar…" : "Validar vendas"}</button></div>
    </div>}
  </section>;
}
