import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("twilio_phone_number")
    .eq("owner_id", user!.id)
    .single();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Connect the Twilio phone number customers will call to reach your booking agent.
      </p>

      <SettingsForm currentNumber={business?.twilio_phone_number ?? ""} className="mt-6 max-w-lg" />
    </div>
  );
}
