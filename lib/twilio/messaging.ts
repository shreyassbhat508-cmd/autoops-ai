import { getTwilioClient } from "./client";

export type MessagingChannel = "sms" | "whatsapp";

export type SendResult = { success: true; sid: string } | { success: false; error: string };

/**
 * Normalizes a stored phone number into E.164 format. Numbers are stored
 * as entered by the customer (e.g. "+91 98765 43210" or "9876543210"),
 * so this strips formatting and applies DEFAULT_COUNTRY_CODE if no
 * country code is present. Adjust DEFAULT_COUNTRY_CODE in .env if most of
 * your customers aren't Indian numbers.
 */
export function toE164(rawPhone: string): string {
  const stripped = rawPhone.replace(/[\s\-().]/g, "");
  if (stripped.startsWith("+")) return stripped;
  const countryCode = process.env.DEFAULT_COUNTRY_CODE || "+91";
  return `${countryCode}${stripped}`;
}

/**
 * Sends a reminder message over real SMS or WhatsApp via Twilio.
 * Distinct from the Claude drafting step — this is the actual dispatch,
 * and it fails loudly (no silent fallback) because a "sent" status that
 * wasn't actually delivered would be actively misleading to the business
 * owner about whether their customer was contacted.
 */
export async function sendReminderMessage(
  toPhoneRaw: string,
  body: string,
  channel: MessagingChannel = (process.env.TWILIO_MESSAGING_CHANNEL as MessagingChannel) || "sms"
): Promise<SendResult> {
  try {
    const client = getTwilioClient();
    const to = toE164(toPhoneRaw);

    if (channel === "whatsapp") {
      const from = process.env.TWILIO_WHATSAPP_NUMBER;
      if (!from) {
        return { success: false, error: "TWILIO_WHATSAPP_NUMBER is not configured" };
      }
      const message = await client.messages.create({
        from: `whatsapp:${from}`,
        to: `whatsapp:${to}`,
        body,
      });
      return { success: true, sid: message.sid };
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      return { success: false, error: "TWILIO_PHONE_NUMBER is not configured" };
    }
    const message = await client.messages.create({ from, to, body });
    return { success: true, sid: message.sid };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Twilio error";
    console.error("Twilio dispatch failed:", detail);
    return { success: false, error: detail };
  }
}
