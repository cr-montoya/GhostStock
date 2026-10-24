import { useState } from "react";

const ABSOLUTE = /^(blob:|data:|https?:|\/)/;
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
  // Remember which src failed, so a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = src && !ABSOLUTE.test(src) ? `/${src}` : src;
  const failed = failedSrc !== null && failedSrc === src;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-bg shadow-[inset_0_0_24px_var(--ink)]",
        className,
      )}
    >
      {url && !failed ? (
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <div className="grid size-full place-items-center" role="img" aria-label={alt}>
          <GhostGlyph className="size-1/2 max-h-12 max-w-12 opacity-40" />
        </div>
      )}
    </div>
  );
}
