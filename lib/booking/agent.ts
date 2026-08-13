import { getAnthropicClient } from "@/lib/anthropic/client";
import type { Slot } from "@/lib/booking/slots";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BookAppointmentInput {
  customer_name: string;
  customer_phone?: string;
  service_type: string;
  slot_iso: string;
}

export type AgentTurnResult =
  | { kind: "reply"; reply: string }
  | { kind: "book_attempt"; reply: string; booking: BookAppointmentInput };

const BOOK_APPOINTMENT_TOOL = {
  name: "book_appointment",
  description:
    "Book a confirmed appointment once the customer has agreed to one specific slot from the available list and you have their name and the service they need. Only call this when the customer has clearly confirmed — not while still discussing options.",
  input_schema: {
    type: "object" as const,
    properties: {
      customer_name: { type: "string" as const, description: "Customer's full name" },
      customer_phone: { type: "string" as const, description: "Customer's phone number, if given" },
      service_type: { type: "string" as const, description: "What service they need, e.g. 'Oil change'" },
      slot_iso: {
        type: "string" as const,
        description: "The exact ISO 8601 datetime string of the chosen slot, copied verbatim from the available slots list — never invent a time.",
      },
    },
    required: ["customer_name", "service_type", "slot_iso"],
  },
};

const FALLBACK_REPLY =
  "Sorry, I'm having trouble connecting right now — could you tell me what day and time works for you, and I'll get you booked in?";

/**
 * Runs one turn of the booking conversation. Claude either replies in
 * plain text (still gathering info / listing slots) or calls the
 * book_appointment tool once it believes the customer has confirmed a
 * specific, valid slot. We never trust the tool call blindly — the
 * caller (lib/booking/actions.ts) re-validates the slot against the
 * live database before actually writing the appointment.
 */
export async function runBookingAgentTurn(
  businessName: string,
  industry: string,
  availableSlots: Slot[],
  history: AgentMessage[]
): Promise<AgentTurnResult> {
  try {
    const anthropic = getAnthropicClient();

    const slotList = availableSlots
      .slice(0, 40) // keep the prompt bounded — 40 slots is ~a week of coverage
      .map((s) => `- ${s.label} (${s.iso})`)
      .join("\n");

    // Claude's Messages API requires the conversation to start with a
    // `user` turn. Our transcripts always open with a scripted assistant
    // greeting (the opening line spoken before the customer says
    // anything), which would make the very first API call start with
    // `assistant` and get rejected. Trim any leading assistant messages
    // so the array we send always starts at the first real user turn.
    const firstUserIndex = history.findIndex((m) => m.role === "user");
    const trimmedHistory = firstUserIndex === -1 ? [] : history.slice(firstUserIndex);

    if (trimmedHistory.length === 0) {
      // Customer hasn't said anything yet — nothing to send the model,
      // just repeat the opening line rather than making an API call.
      return { kind: "reply", reply: history[0]?.content ?? FALLBACK_REPLY };
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: `You are the phone/text booking assistant for ${businessName}, a ${industry.replace(
        "_",
        " "
      )} business. You are speaking with a customer who wants to book an appointment.

Available slots (do not offer or book any time outside this list):
${slotList || "(no slots currently available in the next 7 days)"}

Rules:
- Be brief and natural, like a real front-desk conversation — not a form.
- Find out what service they need and offer 2-3 matching slot options from the list above.
- Once they pick one and confirm, get their name (and phone if they offer it), then call the book_appointment tool with the exact slot_iso from the list.
- Never invent a slot that isn't in the list above.
- If no slots are available, apologize and suggest they call back or check again soon.`,
      tools: [BOOK_APPOINTMENT_TOOL],
      messages: trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const toolBlock = response.content.find((b) => b.type === "tool_use");
    const replyText = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

    if (toolBlock && toolBlock.type === "tool_use" && toolBlock.name === "book_appointment") {
      const input = toolBlock.input as BookAppointmentInput;
      return {
        kind: "book_attempt",
        reply: replyText || "Great — let me get that booked for you.",
        booking: input,
      };
    }

    return { kind: "reply", reply: replyText || FALLBACK_REPLY };
  } catch (err) {
    console.error("Booking agent turn failed, using fallback reply:", err);
    return { kind: "reply", reply: FALLBACK_REPLY };
  }
}
