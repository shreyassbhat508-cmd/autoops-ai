import { NextRequest, NextResponse } from "next/server";
import { verifyTwilioRequest, parseTwilioFormData } from "@/lib/twilio/voice-verify";
import { endCallSession } from "@/lib/booking/call-session";

const TERMINAL_STATUSES = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

/**
 * Configure this URL as the "Status Callback URL" on your Twilio number
 * (or pass statusCallback on the initial webhook response) so hung-up,
 * dropped, or abandoned calls still get their call_sessions row cleaned
 * up — otherwise a caller who hangs up mid-conversation leaves an orphaned
 * row behind instead of just the ones that end via a completed booking.
 */
export async function POST(request: NextRequest) {
  const params = await parseTwilioFormData(request);

  const isValid = await verifyTwilioRequest(request, params);
  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const callSid = params.CallSid;
  const status = params.CallStatus;

  if (callSid && status && TERMINAL_STATUSES.has(status)) {
    await endCallSession(callSid);
  }

  return new NextResponse(null, { status: 204 });
}
