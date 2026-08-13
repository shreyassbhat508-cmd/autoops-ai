import { createClient } from "@/lib/supabase/server";
import { InvoiceTable } from "@/components/recovery/invoice-table";
import { Card } from "@/components/ui/card";

export default async function RecoveryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("business_id", business?.id ?? "")
    .neq("status", "paid")
    .order("due_date", { ascending: true });

  const overdueTotal = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Revenue Recovery</h1>
          <p className="mt-1 text-sm text-muted">
            {invoices && invoices.length > 0
              ? `₹${overdueTotal.toLocaleString("en-IN")} outstanding across ${invoices.length} invoice${
                  invoices.length === 1 ? "" : "s"
                }.`
              : "No outstanding invoices right now."}
          </p>
        </div>
      </div>

      {invoices && invoices.length > 0 ? (
        <InvoiceTable invoices={invoices} className="mt-6" />
      ) : (
        <Card className="mt-6 p-8 text-center text-sm text-muted">
          Nothing to recover — every invoice is paid. New overdue invoices will show up here
          automatically.
        </Card>
      )}
    </div>
  );
}
