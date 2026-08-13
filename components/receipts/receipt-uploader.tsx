"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { UploadCloud, Loader2 } from "lucide-react";
import { uploadAndParseReceipt } from "@/lib/receipts/actions";
import { cn } from "@/lib/utils";

export function ReceiptUploader({ className }: { className?: string }) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;

      const formData = new FormData();
      formData.set("file", file);

      startTransition(async () => {
        const result = await uploadAndParseReceipt(formData);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.priceFlag
            ? "Receipt logged — flagged for an unusual price increase."
            : "Receipt logged successfully."
        );
        router.refresh();
      });
    },
    [router]
  );

  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragging ? "border-accent bg-accent/5" : "border-border",
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      {isPending ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm text-muted">Reading receipt…</p>
        </>
      ) : (
        <>
          <UploadCloud className="h-6 w-6 text-muted" />
          <p className="text-sm text-foreground">
            Drag a receipt here, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-accent hover:underline"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-muted">JPG, PNG, WEBP, GIF, or PDF — up to 10MB</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </Card>
  );
}
