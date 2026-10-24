import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border-strong !bg-surface-raised/95 !text-text !shadow-[0_24px_48px_-12px_var(--ink)] backdrop-blur-xl !font-sans",
          description: "!text-muted-foreground",
          success: "!border-ectoplasm/40 [&_[data-icon]]:!text-ectoplasm",
          error: "!border-blood/40 [&_[data-icon]]:!text-blood",
          actionButton: "!bg-violet !text-white",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
