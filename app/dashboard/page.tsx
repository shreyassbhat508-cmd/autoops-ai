import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PhoneCall, Receipt, Wallet, Clock } from "lucide-react";

export default async function DashboardOverviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const businessId = business?.id;

  const [{ count: pendingAppointments }, { data: overdueInvoices }, { count: receiptsScanned }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "scheduled"),
      supabase
        .from("invoices")
        .select("amount")
        .eq("business_id", businessId)
        .eq("status", "overdue"),
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
    ]);

  const overdueTotal = (overdueInvoices ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);

  const kpis = [
    {
      label: "Pending appointments",
      value: pendingAppointments ?? 0,
      icon: PhoneCall,
      accent: "text-info",
    },
    {
      label: "Unpaid invoices (overdue)",
      value: `₹${overdueTotal.toLocaleString("en-IN")}`,
      icon: Wallet,
      accent: "text-danger",
    },
    {
      label: "Receipts scanned",
      value: receiptsScanned ?? 0,
      icon: Receipt,
      accent: "text-accent",
    },
    {
      label: "Est. hours saved this week",
      value: "—",
      icon: Clock,
      accent: "text-warn",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Overview</h1>
      <p className="mt-1 text-sm text-muted">
        Here&apos;s what&apos;s happening across your business right now.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted">{kpi.label}</span>
              <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <p className="text-sm text-muted">
          Booking agent, receipt scanner, and revenue recovery charts land here next — this
          overview is wired to live Supabase data already, so numbers will update as those
          modules write real rows.
        </p>
      </Card>
    </div>
  );
}
