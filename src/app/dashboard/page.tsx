import { redirect } from "next/navigation";
import { PhaseTwoNav } from "@/components/phase-two-nav";
import { DashboardCards } from "@/features/dashboard/dashboard-cards";
import { machinePanelClasses, machinePanelHeadingClasses } from "@/features/machines/machine-panel-colors";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
function localDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date); }
export default async function DashboardPage() {
  const supabase = await createClient(); if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const today=localDate(new Date()), month=today.slice(0,7)+"-01";
  const [{data:machines},{data:todaySales},{data:monthSales},{data:monthPurchases},{data:monthExpenses},{data:products},{data:warehouse},{data:machineStock},{data:recent}]=await Promise.all([
    supabase.from("machines").select("id,name,code,location,status").order("name"),
    supabase.from("sales").select("total_inc_vat").eq("sale_date",today).eq("status","confirmed"),
    supabase.from("sales").select("total_ex_vat,total_vat,total_inc_vat,total_cost_ex_vat").gte("sale_date",month).lte("sale_date",today).eq("status","confirmed"),
    supabase.from("purchases").select("total_inc_vat").gte("purchase_date",month).lte("purchase_date",today).eq("status","confirmed"),
    supabase.from("expenses").select("amount_ex_vat").gte("expense_date",month).lte("expense_date",today),
    supabase.from("products").select("id,name,average_cost_ex_vat,warehouse_minimum,machine_minimum"),
    supabase.from("warehouse_stock").select("product_id,quantity"),supabase.from("machine_stock").select("product_id,quantity,machine_id"),
    supabase.from("sales").select("machine_id,total_inc_vat,machines(name)").gte("sale_date",month).lte("sale_date",today).eq("status","confirmed")
  ]);
  const sum=(rows:{[key:string]:unknown}[]|null,key:string)=>rows?.reduce((a,r)=>a+Number(r[key]??0),0)??0;
  const saleEx=sum(monthSales,"total_ex_vat"),cost=sum(monthSales,"total_cost_ex_vat"),gross=saleEx-cost,expenses=sum(monthExpenses,"amount_ex_vat");
  const wh=new Map((warehouse??[]).map(x=>[x.product_id,Number(x.quantity)]));let whValue=0,machineValue=0,low=0;
  for(const p of products??[]){const q=wh.get(p.id)??0;whValue+=q*Number(p.average_cost_ex_vat);if(q<=p.warehouse_minimum)low++;for(const s of machineStock??[]){if(s.product_id===p.id){machineValue+=Number(s.quantity)*Number(p.average_cost_ex_vat);if(s.quantity<=p.machine_minimum)low++;}}}
  const salesByMachine=new Map<string,{name:string;total:number}>();for(const s of recent??[]){const m=s.machines as unknown as {name:string}|null;const d=salesByMachine.get(s.machine_id)??{name:m?.name??"Máquina",total:0};d.total+=Number(s.total_inc_vat);salesByMachine.set(s.machine_id,d);}
  const displayName = user.user_metadata?.full_name || user.email || "Utilizador";
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-6"><div><p className="text-sm font-semibold tracking-wide text-[var(--brand)]">VENDING MANAGER</p><h1 className="mt-1 text-2xl font-semibold">Bom dia, {displayName}</h1></div><form action="/auth/signout" method="post"><button className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium">Terminar sessão</button></form></header>
    <div className="mt-5"><PhaseTwoNav /></div><section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Resumo financeiro</h2><p className="mt-1 text-sm text-[var(--muted)]">Hoje e mês corrente · valores registados no sistema.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">{machines?.length??0} máquinas</span></div>
    <DashboardCards cards={[
      { id: "month-sales", title: "Vendas do mês", value: eur.format(sum(monthSales, "total_inc_vat")) },
      { id: "month-expenses", title: "Despesas do mês", value: eur.format(expenses) },
      { id: "gross-margin", title: "Margem bruta do mês", value: eur.format(gross) },
      { id: "operating-result", title: "Resultado estimado do mês", value: eur.format(gross - expenses) },
      { id: "today-sales", title: "Vendas de hoje", value: eur.format(sum(todaySales, "total_inc_vat")) },
      { id: "month-purchases", title: "Compras do mês", value: eur.format(sum(monthPurchases, "total_inc_vat")) },
      { id: "cost-of-sales", title: "Custo dos produtos vendidos", value: eur.format(cost) },
      { id: "stock-value", title: "Valor do stock", value: eur.format(whValue + machineValue), note: `Armazém ${eur.format(whValue)} · máquinas ${eur.format(machineValue)}` },
    ]} />
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section><h2 className="mb-3 text-lg font-semibold">Vendas por máquina este mês</h2><div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-5">{(machines??[]).map(m=>{const v=salesByMachine.get(m.id)?.total??0;const max=Math.max(1,...[...salesByMachine.values()].map(x=>x.total));return <div key={m.id}><div className="mb-1 flex justify-between text-sm"><span>{m.name}</span><strong>{eur.format(v)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${v/max*100}%`}}/></div></div>})}</div></section><section><h2 className="mb-3 text-lg font-semibold">Máquinas e alertas</h2><div className="grid gap-3 sm:grid-cols-2">{(machines??[]).map(m=><article key={m.id} className={`rounded-2xl border p-4 ${machinePanelClasses(m.code)} ${m.code==="M3"?"text-white":""}`}><div className="flex justify-between"><strong className={machinePanelHeadingClasses(m.code)}>{m.name}</strong><span className={`text-xs ${m.code==="M3"?"text-neutral-300":"text-slate-500"}`}>{m.status==="active"?"Ativa":"Inativa"}</span></div><p className={`mt-1 text-sm ${m.code==="M3"?"text-neutral-300":"text-[var(--muted)]"}`}>{m.location||"Localização por definir"}</p><p className="mt-3 text-sm">Vendas: <strong>{eur.format(salesByMachine.get(m.id)?.total??0)}</strong></p></article>)}</div><p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{low} posições de stock no nível mínimo ou abaixo.</p></section></div>
    <p className="mt-8 text-xs text-[var(--muted)]">Resultado operacional é uma estimativa antes de outros ajustamentos e não substitui a contabilidade oficial.</p></section></main>;
}
