import type { ReviewedProduct } from "@ghoststock/contracts";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ImagePlus, RotateCcw, ScanSearch } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { createAnalysis } from "@/api/analyses";
import { toClientError } from "@/api/client";
import { useCreateProducts } from "@/api/queries";
import { createUpload, postToS3 } from "@/api/uploads";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy/es";
import { PhotoFrame, ResurrectionStage } from "@/features/resurrection/ResurrectionStage";
import { ReviewStep } from "@/features/review/ReviewStep";
import { DropZone } from "./DropZone";
import { initialInvocation, invocationReducer, type Photo } from "./invocationReducer";
import { ImageTooLargeError, checkImageFile, resizeImage } from "./resizeImage";

export function InvokePage() {
  const [state, dispatch] = useReducer(invocationReducer, initialInvocation);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const createProducts = useCreateProducts();
  const run = useRef(0);
  const pickRun = useRef(0);
  const [picking, setPicking] = useState(false);
  const [invalidCount, setInvalidCount] = useState(0);
  // Once the user acts, each new step takes focus; the first render never steals it.
  const interacted = useRef(false);
  const focusOnMount = useCallback((element: HTMLElement | null) => {
    if (element && interacted.current) element.focus();
  }, []);
  const previewUrl = "photo" in state ? state.photo.previewUrl : undefined;

  // Release the preview blob URL once the photo is replaced or the page unmounts.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function invalid(reason: "type" | "original-size" | "processed-size" | "unreadable") {
    setInvalidCount((n) => n + 1);
    dispatch({ type: "invalid", error: reason });
  }

  /** Validates and downscales; a newer pick (or leaving the page) wins over a slower one. */
  async function pick(file: File) {
    interacted.current = true;
    const id = ++pickRun.current;
    const check = checkImageFile(file);
    if (!check.ok) return invalid(check.reason);
    setPicking(true);
    try {
      const processed = await resizeImage(file);
      if (id !== pickRun.current) return;
      const photo: Photo = { ...processed, previewUrl: URL.createObjectURL(processed.blob), name: file.name };
      dispatch({ type: "picked", photo });
    } catch (error) {
      if (id !== pickRun.current) return;
      invalid(error instanceof ImageTooLargeError ? "processed-size" : "unreadable");
    } finally {
      if (id === pickRun.current) setPicking(false);
    }
  }

  // Leaving the page cancels a pick still being processed.
  useEffect(
    () => () => {
      pickRun.current += 1;
    },
    [],
  );

  /** Upload (unless S3 already has it) then analyze; stale runs are ignored. */
  async function summon(photo: Photo, existingKey?: string) {
    interacted.current = true;
    const id = ++run.current;
    dispatch({ type: "confirm" });
    try {
      let imageKey = existingKey;
      if (!imageKey) {
        const upload = await createUpload({ contentType: photo.contentType, sizeBytes: photo.blob.size });
        await postToS3(upload, photo.blob);
        if (id !== run.current) return;
        imageKey = upload.imageKey;
        dispatch({ type: "uploaded", imageKey });
      }
      const analysis = await createAnalysis(imageKey);
      if (id === run.current) dispatch({ type: "analyzed", analysis });
    } catch (error) {
      if (id === run.current) dispatch({ type: "failed", error: toClientError(error) });
    }
  }

  function restart() {
    interacted.current = true;
    run.current += 1;
    createProducts.reset();
    dispatch({ type: "reset" });
  }

  function save(imageKey: string, products: ReviewedProduct[]) {
    createProducts.mutate(
      { imageKey, products },
      {
        onSuccess: () => {
          toast.success(copy.review.awakened, { description: copy.review.savedCount(products.length) });
          void navigate("/");
        },
      },
    );
  }

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <>
      {state.step !== "review" && (
        <PageHeader eyebrow={copy.ritual.eyebrow} title={copy.ritual.title} description={copy.ritual.description} />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={state.step === "uploading" || state.step === "analyzing" ? "summoning" : state.step} {...fade}>
          {state.step === "idle" && (
            <DropZone
              onFile={(file) => void pick(file)}
              busy={picking}
              error={state.error ? copy.ritual.errors[state.error] : undefined}
              errorKey={invalidCount}
              focusRef={focusOnMount}
            />
          )}

          {state.step === "preview" && (
            <section aria-labelledby="preview-title" className="flex flex-col items-center gap-6">
              <h2 id="preview-title" className="sr-only">
                {copy.ritual.previewTitle}
              </h2>
              <PhotoFrame src={state.photo.previewUrl} alt={copy.ritual.previewAlt} />
              <div className="flex w-full max-w-xl flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                <Button variant="outline" size="lg" onClick={restart}>
                  <ImagePlus aria-hidden="true" />
                  {copy.common.otherPhoto}
                </Button>
                <Button ref={focusOnMount} size="lg" onClick={() => void summon(state.photo)}>
                  <ScanSearch aria-hidden="true" />
                  {copy.cta.invoke}
                </Button>
              </div>
            </section>
          )}

          {(state.step === "uploading" || state.step === "analyzing") && (
            <ResurrectionStage src={state.photo.previewUrl} phase={state.step} headingRef={focusOnMount} />
          )}

          {(state.step === "failed" || state.step === "zero") && (
            <section aria-labelledby="outcome-title" className="flex flex-col items-center gap-6">
              <PhotoFrame src={state.photo.previewUrl} alt={copy.ritual.previewAlt} dimmed />
              <div role={state.step === "failed" ? "alert" : "status"} className="max-w-md text-center">
                <h2 id="outcome-title" className="text-xl">
                  {state.step === "failed" ? copy.resurrection.failedTitle : copy.resurrection.zeroTitle}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {state.step === "failed" ? copy.errors[state.error.code] : copy.resurrection.zeroBody}
                </p>
              </div>
              <div className="flex w-full max-w-xl flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                <Button variant="outline" size="lg" onClick={restart}>
                  <ImagePlus aria-hidden="true" />
                  {copy.common.otherPhoto}
                </Button>
                <Button
                  ref={focusOnMount}
                  size="lg"
                  onClick={() => void summon(state.photo, state.imageKey)}
                >
                  <RotateCcw aria-hidden="true" />
                  {copy.common.retry}
                </Button>
              </div>
            </section>
          )}

          {state.step === "review" && (
            <ReviewStep
              analysis={state.analysis}
              photoUrl={state.photo.previewUrl}
              saving={createProducts.isPending}
              saveError={createProducts.error}
              onSave={(products) => save(state.imageKey, products)}
              onRestart={restart}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
