"use server";

import { createClient } from "@/lib/supabase/server";
import { extractReceiptData } from "@/lib/anthropic/receipt";
import { detectPriceSpike } from "@/lib/receipts/price-spike";
import { revalidatePath } from "next/cache";

export type UploadReceiptResult =
  | { success: true; receiptId: string; priceFlag: boolean }
  | { error: string };

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function uploadAndParseReceipt(formData: FormData): Promise<UploadReceiptResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided" };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Unsupported file type — please upload a JPG, PNG, WEBP, GIF, or PDF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "File is too large — please keep it under 10MB." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) return { error: "No business found for this account" };

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64Data = Buffer.from(bytes).toString("base64");

  // 1. Extract structured data BEFORE uploading — no point storing a file
  //    we can't parse, and this fails fast on unreadable images.
  const extraction = await extractReceiptData(base64Data, file.type);
  if (!extraction.success) {
    return { error: extraction.error };
  }

  // 2. Upload the original file to private storage, scoped under the
  //    business's own folder (enforced again by storage RLS policies).
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${business.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("receipts").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { error: "Extraction succeeded but saving the file failed — please retry." };
  }

  // 3. Compare against historical line-item prices for this business to
  //    flag abnormal supplier price hikes (plain math, not an LLM guess).
  const { data: pastReceipts } = await supabase
    .from("receipts")
    .select("parsed_data")
    .eq("business_id", business.id)
    .limit(50);

  const priceFlag = detectPriceSpike(extraction.data, pastReceipts ?? []);

  // 4. Insert the receipt row.
  const { data: inserted, error: insertError } = await supabase
    .from("receipts")
    .insert({
      business_id: business.id,
      vendor_name: extraction.data.vendor_name,
      total_amount: extraction.data.total_amount,
      category: extraction.data.category,
      parsed_data: extraction.data,
      receipt_url: path,
      price_flag: priceFlag,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: "File was saved but the receipt record failed — please contact support." };
  }

  revalidatePath("/receipts");
  revalidatePath("/dashboard");

  return { success: true, receiptId: inserted.id, priceFlag };
}

export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 5);
  return data?.signedUrl ?? null;
}
