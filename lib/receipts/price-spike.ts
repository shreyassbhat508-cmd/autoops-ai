import type { ExtractedReceipt } from "@/lib/anthropic/receipt";

const SPIKE_THRESHOLD = 1.2; // 20% above historical average triggers a flag

interface HistoricalReceipt {
  parsed_data: unknown;
}

/**
 * Compares a newly extracted receipt's line-item unit prices against the
 * historical average for items with the same name (case-insensitive) from
 * past receipts. Returns true if any item is >20% above its historical
 * average. This is plain arithmetic, not an LLM judgment call — matches
 * the "flag abnormal supplier price hikes" requirement without asking the
 * model to eyeball what counts as abnormal.
 */
export function detectPriceSpike(
  newReceipt: ExtractedReceipt,
  pastReceipts: HistoricalReceipt[]
): boolean {
  const historyByItem = new Map<string, number[]>();

  for (const past of pastReceipts) {
    const data = past.parsed_data as Partial<ExtractedReceipt> | null;
    if (!data?.line_items) continue;
    for (const item of data.line_items) {
      if (item.unit_price == null) continue;
      const key = item.name.trim().toLowerCase();
      const prices = historyByItem.get(key) ?? [];
      prices.push(item.unit_price);
      historyByItem.set(key, prices);
    }
  }

  for (const item of newReceipt.line_items) {
    if (item.unit_price == null) continue;
    const key = item.name.trim().toLowerCase();
    const history = historyByItem.get(key);
    if (!history || history.length === 0) continue; // no baseline yet — can't flag

    const avg = history.reduce((sum, p) => sum + p, 0) / history.length;
    if (avg > 0 && item.unit_price > avg * SPIKE_THRESHOLD) {
      return true;
    }
  }

  return false;
}
