import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic/client";

const lineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().default(1),
  unit_price: z.number().nullable().default(null),
});

const extractedReceiptSchema = z.object({
  vendor_name: z.string(),
  total_amount: z.number(),
  tax_amount: z.number().nullable().default(null),
  date: z.string().nullable().default(null),
  category: z.enum(["parts", "fluids", "tools", "utilities", "supplies", "other"]).default("other"),
  line_items: z.array(lineItemSchema).default([]),
});

export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>;

export type ExtractionResult =
  | { success: true; data: ExtractedReceipt }
  | { success: false; error: string };

const SYSTEM_PROMPT = `You extract structured data from photos of paper receipts and supplier invoices for a local service business's back office.

Respond with ONLY a JSON object — no preamble, no markdown code fences, no explanation. Shape:
{
  "vendor_name": string,
  "total_amount": number,
  "tax_amount": number or null,
  "date": "YYYY-MM-DD" or null,
  "category": one of "parts" | "fluids" | "tools" | "utilities" | "supplies" | "other",
  "line_items": [{ "name": string, "quantity": number, "unit_price": number or null }]
}

If the image is too blurry or unclear to read a field confidently, use null for that field rather than guessing — accuracy matters more than completeness here. If you genuinely cannot read the receipt at all, respond with {"error": "unreadable"} instead of the shape above.`;

/**
 * Sends a receipt image (or PDF) to Claude for structured extraction.
 * Deliberately does NOT fall back to fabricated placeholder data on
 * failure — unlike the reminder/booking modules, wrong numbers on a real
 * invoice are worse than no numbers, so failures are surfaced honestly.
 */
export async function extractReceiptData(
  base64Data: string,
  mediaType: string
): Promise<ExtractionResult> {
  try {
    const anthropic = getAnthropicClient();

    const isPdf = mediaType === "application/pdf";

    // The Anthropic SDK's TypeScript types don't cleanly express "this
    // array element is either an image block or a document block" without
    // widening — this is a real SDK typing limitation, not a runtime
    // concern; both shapes are valid content blocks the API accepts.
    const contentBlock = isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Data },
        };

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: "Extract this receipt's data." }] as Anthropic.MessageParam["content"],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

    let parsedJson: unknown;
    try {
      // Strip markdown fences defensively in case the model adds them
      // despite instructions.
      const cleaned = rawText.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      parsedJson = JSON.parse(cleaned);
    } catch {
      return { success: false, error: "Claude's response wasn't valid JSON — please try again." };
    }

    if (
      typeof parsedJson === "object" &&
      parsedJson !== null &&
      "error" in parsedJson
    ) {
      return { success: false, error: "The receipt image was too unclear to read." };
    }

    const validated = extractedReceiptSchema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        success: false,
        error: "Extracted data didn't match the expected format — please try a clearer photo.",
      };
    }

    return { success: true, data: validated.data };
  } catch (err) {
    console.error("Receipt extraction failed:", err);
    return {
      success: false,
      error: "Couldn't reach the extraction service — please try again in a moment.",
    };
  }
}
