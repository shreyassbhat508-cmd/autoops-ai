"use client";

import { Fragment, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getReceiptSignedUrl } from "@/lib/receipts/actions";
import { ChevronDown, ChevronUp, TriangleAlert, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface LineItem {
  name: string;
  quantity: number;
  unit_price: number | null;
}

interface Receipt {
  id: string;
  vendor_name: string | null;
  total_amount: number | null;
  category: string | null;
  parsed_data: { line_items?: LineItem[]; date?: string | null } | null;
  receipt_url: string | null;
  price_flag: boolean;
  uploaded_at: string;
}

const CATEGORY_STYLES: Record<string, string> = {
  parts: "bg-info/15 text-info",
  fluids: "bg-accent/15 text-accent",
  tools: "bg-warn/15 text-warn",
  utilities: "bg-muted/15 text-muted",
  supplies: "bg-muted/15 text-muted",
  other: "bg-muted/15 text-muted",
};

export function ReceiptTable({ receipts }: { receipts: Receipt[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [viewingId, setViewingId] = useState<string | null>(null);

  function handleView(receipt: Receipt) {
    if (!receipt.receipt_url) return;
    setViewingId(receipt.id);
    startTransition(async () => {
      const url = await getReceiptSignedUrl(receipt.receipt_url!);
      setViewingId(null);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  if (receipts.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        No receipts scanned yet — drop one above to get started.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3 font-medium">Vendor</th>
            <th className="px-5 py-3 font-medium">Total</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 font-medium">Uploaded</th>
            <th className="px-5 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => {
            const isExpanded = expanded === r.id;
            const lineItems = r.parsed_data?.line_items ?? [];
            return (
              <Fragment key={r.id}>
                <tr className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {r.price_flag && (
                        <span title="Unusual price increase vs. history">
                          <TriangleAlert className="h-4 w-4 text-danger" />
                        </span>
                      )}
                      <span className="font-medium text-foreground">
                        {r.vendor_name ?? "Unknown vendor"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-foreground">
                    {r.total_amount != null ? `₹${Number(r.total_amount).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "rounded-sm px-2 py-1 text-xs font-medium capitalize",
                        CATEGORY_STYLES[r.category ?? "other"]
                      )}
                    >
                      {r.category ?? "other"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted">
                    {new Date(r.uploaded_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      {lineItems.length > 0 && (
                        <Button
                          variant="ghost"
                          className="px-2"
                          onClick={() => setExpanded(isExpanded ? null : r.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        loading={isPending && viewingId === r.id}
                        onClick={() => handleView(r)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
                {isExpanded && lineItems.length > 0 && (
                  <tr className="border-b border-border/60 bg-surfaceRaised/50 last:border-0">
                    <td colSpan={5} className="px-5 py-3.5">
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted">Line items</p>
                      <ul className="space-y-1">
                        {lineItems.map((item, i) => (
                          <li key={i} className="flex justify-between text-sm">
                            <span className="text-foreground">
                              {item.name} {item.quantity > 1 && `× ${item.quantity}`}
                            </span>
                            <span className="font-mono text-muted">
                              {item.unit_price != null
                                ? `₹${item.unit_price.toLocaleString("en-IN")}`
                                : "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
