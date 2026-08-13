import twilio from "twilio";
import { NextRequest } from "next/server";

/**
 * Twilio signs every webhook request with an X-Twilio-Signature header,
 * computed from your auth token + the exact URL + the POST params. This
 * confirms a request claiming to be "an incoming call" actually came from
 * Twilio and not an attacker hitting the endpoint directly to fabricate
 * calls or manipulate an in-progress conversation.
 */
export async function verifyTwilioRequest(
  request: NextRequest,
  params: Record<string, string>
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("TWILIO_AUTH_TOKEN not set — cannot verify webhook signature");
    return false;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Must match the exact URL Twilio was configured to call — including
  // protocol and path. If you're behind a proxy that rewrites the host,
  // set NEXT_PUBLIC_SITE_URL to the externally visible URL Twilio actually
  // hits, not the internal one.
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}${request.nextUrl.pathname}`;

  return twilio.validateRequest(authToken, signature, url, params);
}

export async function parseTwilioFormData(request: NextRequest): Promise<Record<string, string>> {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}
