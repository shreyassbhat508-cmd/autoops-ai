import { createClient } from "@/lib/supabase/server";
import { ReceiptUploader } from "@/components/receipts/receipt-uploader";
import { ReceiptTable } from "@/components/receipts/receipt-table";

export default async function ReceiptsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const { data: receipts } = await supabase
    .from("receipts")
    .select("*")
    .eq("business_id", business?.id ?? "")
    .order("uploaded_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Receipts</h1>
      <p className="mt-1 text-sm text-muted">
        Drop a photo or PDF of a supplier receipt — Claude reads it and logs the costs
        automatically.
      </p>

      <ReceiptUploader className="mt-6" />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted">Recent receipts</h2>
        <ReceiptTable receipts={receipts ?? []} />
      </div>
    </div>
  );
}
