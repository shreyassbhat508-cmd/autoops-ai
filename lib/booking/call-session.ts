import { createAdminClient } from "@/lib/supabase/server";
import type { AgentMessage } from "@/lib/booking/agent";

export interface CallSession {
  call_sid: string;
  business_id: string;
  history: AgentMessage[];
  silence_count: number;
}

export async function createCallSession(
  callSid: string,
  businessId: string,
  openingLine: string
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("call_sessions").insert({
    call_sid: callSid,
    business_id: businessId,
    history: [{ role: "assistant", content: openingLine }],
    silence_count: 0,
  });
}

export async function getCallSession(callSid: string): Promise<CallSession | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("call_sessions").select("*").eq("call_sid", callSid).single();
  return data as CallSession | null;
}

export async function updateCallSession(
  callSid: string,
  history: AgentMessage[],
  silenceCount: number
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("call_sessions")
    .update({ history, silence_count: silenceCount })
    .eq("call_sid", callSid);
}

export async function endCallSession(callSid: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("call_sessions").delete().eq("call_sid", callSid);
}

export async function getBusinessByTwilioNumber(
  twilioNumber: string
): Promise<{ id: string; name: string; industry: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("businesses")
    .select("id, name, industry")
    .eq("twilio_phone_number", twilioNumber)
    .single();
  return data;
}
