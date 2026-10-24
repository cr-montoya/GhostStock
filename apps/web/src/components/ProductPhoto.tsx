import { useState } from "react";
import { cn } from "@/lib/utils";
import { GhostGlyph } from "./brand/GhostGlyph";

interface ProductPhotoProps {
  /** Saved media key (`media/products/...`), a blob URL, or null when there is no photo. */
  src: string | null;
  alt: string;
  className?: string;
}

/** Product photos always sit in a dark frame with object-cover; a ghost marks a missing one. */
export function ProductPhoto({ src, alt, className }: ProductPhotoProps) {
  const [failed, setFailed] = useState(false);
  const url = src && !src.startsWith("blob:") && !src.startsWith("/") ? `/${src}` : src;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-bg shadow-[inset_0_0_24px_var(--ink)]",
        className,
      )}
    >
      {url && !failed ? (
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="grid size-full place-items-center" role="img" aria-label={alt}>
          <GhostGlyph className="size-1/2 max-h-12 max-w-12 opacity-40" />
        </div>
      )}
    </div>
  );
}
