import { createClient } from "@/lib/supabase/server";
import { CallSimulator } from "@/components/booking/call-simulator";

export default async function BookingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("business_id", business?.id ?? "")
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true })
    .limit(20);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Booking Agent</h1>
      <p className="mt-1 text-sm text-muted">
        Simulates an inbound customer call or text conversation. In production this text is fed
        by a speech-to-text layer (Twilio/Deepgram) on real phone calls — the reasoning and
        booking logic below is the same either way.
      </p>

      <CallSimulator initialAppointments={appointments ?? []} className="mt-6" />
    </div>
  );
}
