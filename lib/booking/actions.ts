"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { generateAvailableSlots, type Slot } from "@/lib/booking/slots";
import { runBookingTurn, type AgentTurnOutcome, type BusinessContext } from "@/lib/booking/core";
import type { AgentMessage } from "@/lib/booking/agent";
import { revalidatePath } from "next/cache";

// Explicit discriminated union — without this annotation, TypeScript's
// control-flow narrowing on `"error" in ctx` below doesn't reliably narrow
// the inferred return type of an async function, and callers end up with
// the full union (including the success branch) even inside the
// early-return error path. Naming the type makes the narrowing sound.
type BusinessLookup =
  | { error: string }
  | { supabase: SupabaseClient; business: BusinessContext };

async function getCurrentBusiness(): Promise<BusinessLookup> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, industry")
    .eq("owner_id", user.id)
    .single();
  if (!business) return { error: "No business found for this account" };

  return { supabase, business };
}

export async function getBookingContext(): Promise<{ slots: Slot[] } | { error: string }> {
  const ctx = await getCurrentBusiness();
  if ("error" in ctx) return ctx;

  const { data: upcoming } = await ctx.supabase
    .from("appointments")
    .select("scheduled_at")
    .eq("business_id", ctx.business.id)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString());

  return { slots: generateAvailableSlots((upcoming ?? []).map((a) => a.scheduled_at)) };
}

export async function sendBookingMessage(
  history: AgentMessage[]
): Promise<AgentTurnOutcome | { error: string }> {
  const ctx = await getCurrentBusiness();
  if ("error" in ctx) return ctx;

  const outcome = await runBookingTurn(ctx.supabase, ctx.business, history);

  if (outcome.booked) {
    revalidatePath("/booking");
    revalidatePath("/dashboard");
  }

  return outcome;
}
