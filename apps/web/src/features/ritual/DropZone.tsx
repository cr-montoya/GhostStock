import { Camera, ImageUp } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";
import { SummoningCircle } from "./SummoningCircle";

interface DropZoneProps {
  onFile: (file: File) => void;
  error?: string;
  busy?: boolean;
  /** Changes on every rejected pick, so a repeated error is announced again. */
  errorKey?: number;
  /** Receives the "Elegir foto" button so the page can focus it after a reset. */
  focusRef?: (element: HTMLElement | null) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

/** The ritual: drop a photo into the summoning circle, pick a file, or open the camera. */
export function DropZone({ onFile, error, busy = false, errorKey, focusRef }: DropZoneProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const errorId = useId();
  const hintId = useId();

  function take(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files);
  }

  return (
    <section aria-labelledby="ritual-title" className="flex flex-col items-center">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        className={cn(
          "relative isolate mx-auto flex aspect-square w-full max-w-[560px] flex-col items-center justify-center rounded-full text-center transition-[box-shadow] duration-300",
          dragging && "shadow-[inset_0_0_120px_var(--violet-glow),0_0_80px_var(--violet-glow)]",
        )}
      >
        <SummoningCircle active={hover} dragging={dragging} />
        <div className="relative z-10 flex max-w-[20rem] flex-col items-center gap-3 rounded-full bg-[radial-gradient(closest-side,var(--bg)_60%,transparent)] px-10 py-8">
          <span className="grid size-14 place-items-center rounded-full border border-violet-soft/40 bg-surface/80 shadow-[0_0_32px_-6px_var(--violet-glow)]">
            <ImageUp className="size-6 text-violet-soft" aria-hidden="true" />
          </span>
          <p className="font-display text-lg leading-snug" id="ritual-title">
            {dragging ? (
              copy.ritual.dropNow
            ) : (
              <>
                <span className="md:hidden">{copy.ritual.tapTitle}</span>
                <span className="hidden md:inline">{copy.ritual.dropTitle}</span>
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground" id={hintId}>
            {copy.ritual.formats}
          </p>
          <Button
            ref={focusRef}
            type="button"
            variant="outline"
            className="mt-1"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          >
            {busy ? copy.ritual.processing : copy.ritual.pick}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={copy.ritual.fileInput}
          onChange={(event) => {
            take(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <div className="mt-6 w-full max-w-sm md:hidden">
        <Button type="button" size="lg" className="h-14 w-full text-base" disabled={busy} onClick={() => cameraInput.current?.click()}>
          <Camera className="size-5" aria-hidden="true" />
          {copy.ritual.camera}
        </Button>
        <input
          ref={cameraInput}
          type="file"
          accept={ACCEPT}
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-label={copy.ritual.cameraInput}
          onChange={(event) => {
            take(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <p
        key={errorKey}
        id={errorId}
        role="alert"
        className={cn("mt-5 min-h-6 max-w-md text-center text-sm text-blood", !error && "invisible")}
      >
        {error}
      </p>
    </section>
  );
}
