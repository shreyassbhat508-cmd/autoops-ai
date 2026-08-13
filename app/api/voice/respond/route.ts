import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { verifyTwilioRequest, parseTwilioFormData } from "@/lib/twilio/voice-verify";
import { getCallSession, updateCallSession, endCallSession } from "@/lib/booking/call-session";
import { runBookingTurn } from "@/lib/booking/core";
import { createAdminClient } from "@/lib/supabase/server";

const VOICE = "Polly.Aditi";
const MAX_SILENCES = 2;

function gatherResponse(reply: string, callSid: string) {
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: ["speech"],
    action: `${process.env.NEXT_PUBLIC_SITE_URL}/api/voice/respond`,
    method: "POST",
    speechTimeout: "auto",
    speechModel: "phone_call",
    language: "en-IN",
  });
  gather.say({ voice: VOICE, language: "en-IN" }, reply);
  twiml.say({ voice: VOICE, language: "en-IN" }, "Sorry, I didn't catch that. Goodbye for now.");
  twiml.hangup();
  return twiml;
}

function endCall(reply: string) {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: VOICE, language: "en-IN" }, reply);
  twiml.hangup();
  return twiml;
}

export async function POST(request: NextRequest) {
  const params = await parseTwilioFormData(request);

  const isValid = await verifyTwilioRequest(request, params);
  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const callSid = params.CallSid;
  const speechResult = params.SpeechResult?.trim();

  const session = await getCallSession(callSid);
  if (!session) {
    const twiml = endCall("Sorry, something went wrong with this call. Please call back.");
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // No speech was heard at all this turn — re-prompt a limited number of
  // times before giving up gracefully, rather than looping forever.
  if (!speechResult) {
    const silenceCount = session.silence_count + 1;
    if (silenceCount > MAX_SILENCES) {
      await endCallSession(callSid);
      const twiml = endCall("I'm having trouble hearing you — please call back when you can. Goodbye.");
      return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
    }
    await updateCallSession(callSid, session.history, silenceCount);
    const twiml = gatherResponse("Sorry, could you repeat that?", callSid);
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  const nextHistory = [...session.history, { role: "user" as const, content: speechResult }];

  const admin = createAdminClient();
  const { data: business } = await admin
    .from("businesses")
    .select("id, name, industry")
    .eq("id", session.business_id)
    .single();

  if (!business) {
    await endCallSession(callSid);
    const twiml = endCall("Sorry, something went wrong. Please call back.");
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  const outcome = await runBookingTurn(admin, business, nextHistory);
  const updatedHistory = [...nextHistory, { role: "assistant" as const, content: outcome.reply }];

  if (outcome.booked) {
    await endCallSession(callSid);
    const twiml = endCall(outcome.reply);
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  await updateCallSession(callSid, updatedHistory, 0); // reset silence count on real speech
  const twiml = gatherResponse(outcome.reply, callSid);
  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
