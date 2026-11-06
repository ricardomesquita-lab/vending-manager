export function machinePanelClasses(code: string | null | undefined): string {
  if (code === "M1") return "border-violet-200 bg-violet-50";
  if (code === "M2") return "border-[#b9827b] bg-[#ead0cc]";
  if (code === "M3") return "border-neutral-800 bg-neutral-900";
  return "border-[var(--line)] bg-white";
}

export function machinePanelHeadingClasses(code: string | null | undefined): string {
  return code === "M3" ? "text-white" : "";
}
