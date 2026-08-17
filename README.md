# AutoOps AI
### The Autonomous Operational Co-Pilot for Local Businesses

Local service business owners — mechanics, HVAC contractors, bakers — lose 15+ hours a week to phone calls, chasing unpaid invoices, and manually logging supplier receipts. AutoOps AI automates all three with AI agents that actually take action, not just summarize.

## What it does

**📞 Booking Agent** — Handles inbound customer conversations (via a live chat interface, with the underlying logic architected for real phone calls through Twilio Voice), checks real calendar availability, and books confirmed appointments directly — with built-in double-booking protection.

**🧾 Receipt Scanner** — Drag-and-drop a photo of a paper supplier receipt. Claude's vision reads it directly (no separate OCR step), extracts vendor, total, and line items, and automatically flags line items priced 20%+ above your historical average for that item.

**💰 Revenue Recovery** — Surfaces every overdue invoice by aging bucket (30/60/90 days) and drafts personalized, context-aware payment reminders via Claude — ready to dispatch over real SMS/WhatsApp through Twilio.

## Why it's different

Most hackathon AI demos are a chatbot wrapper. AutoOps AI is built on real infrastructure:
- **Real authentication** — Supabase Auth with actual email verification, not a stubbed login
- **Real data isolation** — Row Level Security on every table, so each business only ever sees its own data, enforced at the database level, not just in application code
- **Real AI, used correctly** — Claude's tool-use (function calling) drives the booking agent so it can never hallucinate an appointment slot; the receipt scanner refuses to fabricate numbers on a failed extraction rather than guessing
- **Honest engineering** — price-spike detection is plain statistics compared against your own history, not an LLM "vibe check"

## Tech stack

- **Frontend/Backend**: Next.js 14 (App Router, TypeScript, Server Actions)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security + Auth)
- **AI**: Anthropic Claude (vision extraction, tool-use agents, drafting)
- **Messaging/Voice**: Twilio (SMS, WhatsApp, Voice + built-in speech-to-text/text-to-speech)
- **UI**: Tailwind CSS, Lucide icons, Recharts

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase + Anthropic keys
npm run dev
```

Run `supabase/schema.sql` in your Supabase SQL Editor first, then `supabase/migrations/0003_receipts_storage.sql` for receipt file storage. Full setup details, including Twilio Voice/SMS configuration, are in `SETUP.md`.

## Architecture highlights

- `lib/booking/core.ts` — shared booking logic used by **both** the web chat interface and real inbound phone calls, so slot validation and double-booking protection can't drift between the two
- `lib/anthropic/*` — every Claude call has a defined failure mode: reminders/booking gracefully fall back to templates so a rate limit never breaks the demo; receipt extraction fails loudly and honestly instead, because a wrong number on a real invoice is worse than no number
- Full Row Level Security policies across `businesses`, `appointments`, `invoices`, and `receipts` — see `supabase/schema.sql`

## Team / Built by

Shreyas Bhat — B.Tech CSE, REVA University, Bengaluru
