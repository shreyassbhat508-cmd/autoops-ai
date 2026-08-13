import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { verifyTwilioRequest, parseTwilioFormData } from "@/lib/twilio/voice-verify";
import { createCallSession, getBusinessByTwilioNumber } from "@/lib/booking/call-session";

const OPENING_LINE = "Thanks for calling — what can I help you get booked in for?";
const VOICE = "Polly.Aditi"; // Indian English Amazon Polly voice via Twilio <Say>

export async function POST(request: NextRequest) {
  const params = await parseTwilioFormData(request);

  const isValid = await verifyTwilioRequest(request, params);
  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const toNumber = params.To;
  const callSid = params.CallSid;

  const twiml = new twilio.twiml.VoiceResponse();

  const business = toNumber ? await getBusinessByTwilioNumber(toNumber) : null;

  if (!business) {
    twiml.say(
      { voice: VOICE, language: "en-IN" },
      "Sorry, this number isn't set up with a business yet. Goodbye."
    );
    twiml.hangup();
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  await createCallSession(callSid, business.id, OPENING_LINE);

  const gather = twiml.gather({
    input: ["speech"],
    action: `${process.env.NEXT_PUBLIC_SITE_URL}/api/voice/respond`,
    method: "POST",
    speechTimeout: "auto",
    speechModel: "phone_call",
    language: "en-IN",
  });
  gather.say({ voice: VOICE, language: "en-IN" }, OPENING_LINE);

  // Reached only if Gather times out with zero input at all.
  twiml.say({ voice: VOICE, language: "en-IN" }, "Sorry, I didn't catch that. Please call back.");
  twiml.hangup();

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
