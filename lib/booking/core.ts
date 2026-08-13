import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAvailableSlots } from "@/lib/booking/slots";
import { runBookingAgentTurn, type AgentMessage } from "@/lib/booking/agent";

export interface BusinessContext {
  id: string;
  name: string;
  industry: string;
}

export type AgentTurnOutcome =
  | { reply: string; booked: false }
  | { reply: string; booked: true; appointmentLabel: string };

/**
 * Runs one booking conversation turn for a given business and writes the
 * appointment if the agent confirms a booking — re-validating the slot
 * against the live database immediately before insert either way.
 *
 * Takes the Supabase client as a parameter rather than constructing one
 * itself: the authenticated web flow passes an RLS-scoped client tied to
 * the logged-in owner's session, while the voice webhook flow (which has
 * no user session at all — Twilio calls in cold) passes the service-role
 * admin client instead, having already resolved `business` from the
 * Twilio "To" number. Both paths hit the exact same booking logic, so
 * there's only one place double-booking protection can drift.
 */
export async function runBookingTurn(
  supabase: SupabaseClient,
  business: BusinessContext,
  history: AgentMessage[]
): Promise<AgentTurnOutcome> {
  const { data: upcoming } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .eq("business_id", business.id)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString());

  const slots = generateAvailableSlots((upcoming ?? []).map((a) => a.scheduled_at));

  const result = await runBookingAgentTurn(business.name, business.industry, slots, history);

  if (result.kind === "reply") {
    return { reply: result.reply, booked: false };
  }

  const { customer_name, customer_phone, service_type, slot_iso } = result.booking;
  const chosenSlot = slots.find((s) => s.iso === slot_iso);

  if (!chosenSlot) {
    return {
      reply:
        "That time doesn't look available anymore — could you pick another slot from the ones I mentioned?",
      booked: false,
    };
  }

  const { data: conflict } = await supabase
    .from("appointments")
    .select("id")
    .eq("business_id", business.id)
    .eq("scheduled_at", slot_iso)
    .eq("status", "scheduled")
    .maybeSingle();

  if (conflict) {
    return {
      reply: "Someone just grabbed that slot — could you pick a different time?",
      booked: false,
    };
  }

  const { error: insertError } = await supabase.from("appointments").insert({
    business_id: business.id,
    customer_name,
    customer_phone: customer_phone ?? null,
    service_type,
    scheduled_at: slot_iso,
    status: "scheduled",
  });

  if (insertError) {
    return { reply: "I hit an error booking that — mind trying again in a moment?", booked: false };
  }

  return {
    reply: `${result.reply} You're booked for ${chosenSlot.label} — see you then!`,
    booked: true,
    appointmentLabel: chosenSlot.label,
  };
}
