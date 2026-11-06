type ThumbnailSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<ThumbnailSize, string> = {
  xs: "h-7 w-7",
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export function ProductThumbnail({ imageUrl, name, size = "sm" }: { imageUrl?: string | null; name: string; size?: ThumbnailSize }) {
  return <span aria-hidden="true" title={name} className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-white ${sizeClasses[size]}`}>
    {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-contain p-0.5" /> : <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2 text-slate-400" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12v8.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
  </span>;
}
