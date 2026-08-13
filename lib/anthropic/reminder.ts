import { getAnthropicClient } from "./client";

export interface ReminderInput {
  businessName: string;
  customerName: string;
  amount: number;
  daysOverdue: number;
  invoiceSummary: string; // short human-readable line items, e.g. "Full service, oil change"
}

const FALLBACK_TEMPLATE = ({
  businessName,
  customerName,
  amount,
  daysOverdue,
}: ReminderInput) =>
  `Hi ${customerName}, this is ${businessName}. Just a friendly reminder that your invoice of ₹${amount.toLocaleString(
    "en-IN"
  )} is ${daysOverdue} days overdue. Please pay at your earliest convenience: [payment link]. Thank you!`;

/**
 * Drafts a short, personalized SMS/WhatsApp payment reminder using Claude.
 * Falls back to a plain template if the API key is missing or the call
 * fails — this is a hackathon/demo-critical path, it must never hard-fail.
 */
export async function draftPaymentReminder(input: ReminderInput): Promise<string> {
  try {
    const anthropic = getAnthropicClient();

    const tone =
      input.daysOverdue > 60
        ? "firm but still professional and non-threatening — this is the second or third reminder"
        : "friendly and low-pressure — this is likely their first reminder";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      system:
        "You draft short SMS/WhatsApp payment reminder messages on behalf of small local service businesses (mechanics, HVAC contractors, bakeries) to their customers. " +
        "Keep it under 3 sentences, warm but clear about the amount and urgency, no legal threats, no excessive apology from the business. " +
        "End with a placeholder '[payment link]' for where the real link will be inserted. Respond with ONLY the message text — no preamble, no quotes, no markdown.",
      messages: [
        {
          role: "user",
          content: `Business: ${input.businessName}
Customer: ${input.customerName}
Amount owed: ₹${input.amount.toLocaleString("en-IN")}
Days overdue: ${input.daysOverdue}
What the invoice was for: ${input.invoiceSummary || "services rendered"}
Tone: ${tone}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const draft = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

    return draft || FALLBACK_TEMPLATE(input);
  } catch (err) {
    console.error("Claude reminder drafting failed, using fallback template:", err);
    return FALLBACK_TEMPLATE(input);
  }
}
