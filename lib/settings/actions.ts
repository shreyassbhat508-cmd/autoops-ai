"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SettingsResult = { error: string } | { success: true };

export async function updateTwilioNumber(formData: FormData): Promise<SettingsResult> {
  const raw = String(formData.get("twilioPhoneNumber") ?? "").trim();
  const twilioPhoneNumber = raw === "" ? null : raw;

  if (twilioPhoneNumber && !/^\+[1-9]\d{6,14}$/.test(twilioPhoneNumber)) {
    return { error: "Enter the number in E.164 format, e.g. +14155551234" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("businesses")
    .update({ twilio_phone_number: twilioPhoneNumber })
    .eq("owner_id", user.id);

  if (error) {
    // Most likely cause: another business already claimed this number
    // (the column has a unique constraint).
    return { error: "Couldn't save — that number may already be in use by another business." };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
