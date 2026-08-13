export type AgingBucket = "current" | "30" | "60" | "90+";

export function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function agingBucket(dueDate: string): AgingBucket {
  const days = daysOverdue(dueDate);
  if (days <= 0) return "current";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return "90+";
}

export function summarizeLineItems(lineItems: unknown): string {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return "";
  return lineItems
    .map((item) => (typeof item === "object" && item && "item" in item ? String((item as any).item) : null))
    .filter(Boolean)
    .join(", ");
}
