"use server";

import { createClient } from "@/lib/supabase/server";
import { draftPaymentReminder } from "@/lib/anthropic/reminder";
import { sendReminderMessage, type MessagingChannel } from "@/lib/twilio/messaging";
import { daysOverdue, summarizeLineItems } from "@/lib/recovery/aging";
import { revalidatePath } from "next/cache";

export type SendReminderResult =
  | { success: true; message: string }
  | { error: string };

/**
 * Drafts a reminder via Claude and actually dispatches it over real
 * SMS/WhatsApp via Twilio. Ownership is enforced by RLS through the
 * request-scoped Supabase client — a user can never touch an invoice
 * belonging to another business, even if they guess the ID. Delivery
 * failures are saved and surfaced rather than silently swallowed.
 */
export async function sendReminder(invoiceId: string): Promise<SendReminderResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .single();
  if (!business) return { error: "No business found for this account" };

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("business_id", business.id) // redundant with RLS, but explicit is safer
    .single();

  if (fetchError || !invoice) {
    return { error: "Invoice not found or you don't have access to it" };
  }

  if (!invoice.customer_phone) {
    return { error: `${invoice.customer_name} has no phone number on file — can't send a reminder.` };
  }

  const draft = await draftPaymentReminder({
    businessName: business.name,
    customerName: invoice.customer_name,
    amount: Number(invoice.amount),
    daysOverdue: daysOverdue(invoice.due_date),
    invoiceSummary: summarizeLineItems(invoice.line_items),
  });

  const channel: MessagingChannel =
    (process.env.TWILIO_MESSAGING_CHANNEL as MessagingChannel) || "sms";
  const dispatch = await sendReminderMessage(invoice.customer_phone, draft, channel);

  // The draft and the attempt are saved either way — a failed send still
  // needs to be visible to the business owner, not silently dropped.
  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: dispatch.success ? "reminder_sent" : invoice.status,
      last_reminder_sent_at: new Date().toISOString(),
      last_reminder_message: draft,
      last_reminder_channel: channel,
      last_reminder_delivery_status: dispatch.success ? "sent" : "failed",
    })
    .eq("id", invoiceId);

  if (updateError) {
    return { error: "Reminder was drafted but saving it failed — please retry." };
  }

  revalidatePath("/recovery");

  if (!dispatch.success) {
    return { error: `Message drafted, but delivery failed: ${dispatch.error}` };
  }

  return { success: true, message: draft };
}

export interface RunAgentResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Runs the recovery agent across every overdue invoice that hasn't had a
 * reminder sent in the last 3 days (avoids spamming the same customer on
 * every click).
 */
export async function runRecoveryAgent(): Promise<RunAgentResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sent: 0, failed: 0, errors: ["Not authenticated"] };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) return { sent: 0, failed: 0, errors: ["No business found"] };

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates } = await supabase
    .from("invoices")
    .select("id")
    .eq("business_id", business.id)
    .in("status", ["overdue", "reminder_sent"])
    .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${threeDaysAgo}`);

  if (!candidates || candidates.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Sequential on purpose — keeps this gentle on the Claude API rate limit
  // and easy to reason about for a first version. Can parallelize with a
  // concurrency limiter later if invoice volume grows.
  for (const { id } of candidates) {
    const result = await sendReminder(id);
    if ("error" in result) {
      failed += 1;
      errors.push(result.error);
    } else {
      sent += 1;
    }
  }

  revalidatePath("/recovery");
  return { sent, failed, errors };
}
