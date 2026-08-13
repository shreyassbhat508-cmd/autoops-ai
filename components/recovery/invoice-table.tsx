"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sendReminder, runRecoveryAgent } from "@/lib/recovery/actions";
import { agingBucket, daysOverdue, type AgingBucket } from "@/lib/recovery/aging";
import { cn } from "@/lib/utils";
import { Zap, ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";

interface Invoice {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  amount: number;
  due_date: string;
  status: string;
  last_reminder_sent_at: string | null;
  last_reminder_message: string | null;
  last_reminder_channel: string | null;
  last_reminder_delivery_status: string | null;
}

const BUCKET_STYLES: Record<AgingBucket, string> = {
  current: "bg-muted/15 text-muted",
  "30": "bg-warn/15 text-warn",
  "60": "bg-warn/25 text-warn",
  "90+": "bg-danger/15 text-danger",
};

const STATUS_STYLES: Record<string, string> = {
  overdue: "bg-danger/15 text-danger",
  reminder_sent: "bg-info/15 text-info",
  pending: "bg-muted/15 text-muted",
  paid: "bg-accent/15 text-accent",
};

export function InvoiceTable({ invoices, className }: { invoices: Invoice[]; className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleRunAgent() {
    startTransition(async () => {
      const result = await runRecoveryAgent();
      if (result.errors.length > 0 && result.sent === 0) {
        toast.error(result.errors[0] ?? "Recovery agent failed to run.");
        if (result.failed > 0) router.refresh();
        return;
      }
      if (result.sent === 0) {
        toast.info("Nothing to send — everyone's already been reminded recently.");
        return;
      }
      toast.success(
        `Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"}${
          result.failed ? `, ${result.failed} failed` : ""
        }.`
      );
      router.refresh();
    });
  }

  function handleSendOne(id: string) {
    setRowPending(id);
    startTransition(async () => {
      const result = await sendReminder(id);
      setRowPending(null);
      if ("error" in result) {
        toast.error(result.error);
        router.refresh(); // still refresh — a failed dispatch was saved and should show
        return;
      }
      toast.success("Reminder sent.");
      setExpanded(id);
      router.refresh();
    });
  }

  return (
    <div className={className}>
      <div className="mb-4 flex justify-end">
        <Button onClick={handleRunAgent} loading={isPending && rowPending === null}>
          <Zap className="h-4 w-4" />
          Run Recovery Agent
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Due date</th>
              <th className="px-5 py-3 font-medium">Aging</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const bucket = agingBucket(inv.due_date);
              const overdue = daysOverdue(inv.due_date);
              const isExpanded = expanded === inv.id;
              return (
                <Fragment key={inv.id}>
                  <tr className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{inv.customer_name}</p>
                      {inv.customer_phone && (
                        <p className="text-xs text-muted">{inv.customer_phone}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-foreground">
                      ₹{Number(inv.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {new Date(inv.due_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-sm px-2 py-1 text-xs font-medium",
                          BUCKET_STYLES[bucket]
                        )}
                      >
                        {bucket === "current" ? "Not yet due" : `${overdue}d overdue`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-sm px-2 py-1 text-xs font-medium capitalize",
                          STATUS_STYLES[inv.status] ?? "bg-muted/15 text-muted"
                        )}
                      >
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        {inv.last_reminder_message && (
                          <Button
                            variant="ghost"
                            className="px-2"
                            onClick={() => setExpanded(isExpanded ? null : inv.id)}
                          >
                            <MessageSquareText className="h-4 w-4" />
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          loading={rowPending === inv.id}
                          onClick={() => handleSendOne(inv.id)}
                        >
                          Send reminder
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && inv.last_reminder_message && (
                    <tr className="border-b border-border/60 bg-surfaceRaised/50 last:border-0">
                      <td colSpan={6} className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs uppercase tracking-wide text-muted">
                            {inv.last_reminder_delivery_status === "failed"
                              ? "Delivery failed"
                              : `Sent via ${inv.last_reminder_channel ?? "sms"}`}
                            {inv.last_reminder_sent_at &&
                              ` · ${new Date(inv.last_reminder_sent_at).toLocaleString("en-IN")}`}
                          </p>
                          {inv.last_reminder_delivery_status === "failed" && (
                            <span className="rounded-sm bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                              FAILED
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm text-foreground">
                          {inv.last_reminder_message}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
