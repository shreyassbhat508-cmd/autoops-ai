# AutoOps AI

Operational co-pilot for local service businesses — voice booking, receipt scanning, and revenue recovery. This step covers the **foundation**: project scaffold + real, working authentication with email verification.

## What's built so far

- Signup (business name + industry + email + password) → creates an `auth.users` row **and** a matching `businesses` row atomically
- Email verification (real Supabase-sent email, not a stub) — unverified users are blocked from the dashboard
- Login / logout
- Resend verification email
- Middleware-enforced route protection (`/dashboard`, `/booking`, `/receipts`, `/recovery` all require a verified session)
- Row Level Security on every table — each business owner can only ever see their own data, enforced at the database level (not just in app code)
- Dashboard shell with sidebar nav, pulling real (if currently sparse) data from Supabase

## Setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New Project. Wait for it to provision.

### 2. Run the schema
In your Supabase project → **SQL Editor** → paste the contents of `supabase/schema.sql` → Run.
This creates all four tables and their RLS policies. The seed data at the bottom is commented out on purpose — uncomment it *after* you've signed up once and have a real `auth.users.id` to attach it to.

### 3. Configure email verification
Supabase → **Authentication → Providers → Email**: confirm "Confirm email" is turned ON (it is by default).
Supabase → **Authentication → URL Configuration**: set:
- Site URL: `http://localhost:3000` (change to your real domain later)
- Redirect URLs: add `http://localhost:3000/auth/callback`

Optional but recommended: Authentication → Email Templates → "Confirm signup" — customize the copy so it doesn't look like a generic Supabase email.

### 4. Get your API keys
Supabase → **Project Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ never expose this to the client — it bypasses RLS entirely, used server-side only in `lib/auth-actions.ts` to create the business row atomically at signup)

### 5. Environment variables
```bash
cp .env.local.example .env.local
```
Fill in the Supabase values above. `ANTHROPIC_API_KEY` isn't needed yet — that's for the next step (receipt scanner + booking agent).

### 6. Install and run
```bash
npm install
npm run dev
```
Visit `http://localhost:3000` — it'll redirect you to `/signup`.

## Try the full auth flow
1. Sign up with a real email you can check.
2. You'll land on "Check your inbox" — click the link Supabase emails you.
3. You're redirected to `/dashboard`, now with a live session.
4. Try visiting `/dashboard` in an incognito window (no session) — you should bounce to `/login`.
5. Try logging in before verifying — you should be sent to `/verify-email` instead of the dashboard.

## Revenue Recovery module (`/recovery`)

- Lists every unpaid invoice with an aging bucket (current / 30 / 60 / 90+ days).
- **"Run Recovery Agent"** — goes through every overdue invoice that hasn't had a reminder in the last 3 days, drafts a personalized SMS/WhatsApp message per invoice via Claude, and **actually sends it over real Twilio SMS or WhatsApp**.
- **"Send reminder"** on a single row does the same for just that invoice.
- Every drafted message is saved (`last_reminder_message`) and viewable by clicking the message icon next to a row, along with real delivery status (`sent` / `failed`) and channel.
- If drafting fails (Claude API down/missing key), it falls back to a plain template rather than blocking the send. If **delivery** fails (bad phone number, Twilio error, unconfigured channel), that failure is saved and shown honestly — the invoice status is NOT marked `reminder_sent` unless the message actually went out, and it'll be retried on the next agent run.
- Invoices with no `customer_phone` on file are skipped with a clear message rather than silently failing.

### To use it — real setup required
1. Add `ANTHROPIC_API_KEY` to `.env.local` (drafting).
2. Sign up at [twilio.com](https://twilio.com), get an **Account SID** and **Auth Token** from the console, and add them to `.env.local` as `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
3. For **SMS**: buy a Twilio phone number (Console → Phone Numbers) and set it as `TWILIO_PHONE_NUMBER`.
   - **If your customers are in India**: TRAI requires **DLT registration** before you can send transactional/promotional SMS to Indian numbers — this is a regulatory requirement, not a Twilio-specific hoop. You register your business, sender ID, and message template at a DLT platform (e.g. via your telecom operator or [Twilio's DLT guide](https://www.twilio.com/docs/sms/india-dlt-guidelines)) before SMS will actually deliver to Indian carriers.
4. For **WhatsApp**: Twilio's WhatsApp sandbox works instantly for testing (Console → Messaging → Try WhatsApp) — for production you'll need to register a WhatsApp Business sender through Twilio, which goes through Meta's approval process. Set the approved number as `TWILIO_WHATSAPP_NUMBER`.
5. Set `TWILIO_MESSAGING_CHANNEL` to `sms` or `whatsapp` depending on which you've set up.
6. If you already ran the original `schema.sql`, also run `supabase/migrations/0002_add_last_reminder_message.sql` and `supabase/migrations/0004_reminder_delivery_tracking.sql`.
7. Add a few overdue invoices with a real `customer_phone` you can check, then try both the per-row and bulk actions.

## Booking Agent module (`/booking`)

- A chat-style "Test AI Call Assistant" simulator — you type as if you're the customer (standing in for what a speech-to-text layer would produce from a real phone call).
- Claude drives the conversation using **tool use** (not freeform JSON parsing) — it only calls `book_appointment` once it believes the customer has confirmed a specific slot, and the tool schema forces it to copy the slot's exact ISO timestamp rather than inventing one.
- **Real double-booking protection**: available slots are computed live from actual scheduled appointments (business hours 9am–6pm, Mon–Sat, next 7 days), and every booking attempt is re-validated against the database immediately before insert — so two near-simultaneous bookings can't both land on the same slot.
- The "Upcoming appointments" panel on the right updates automatically the moment a booking succeeds.
- Same demo-safety pattern as the recovery agent: if the Claude call fails, the agent gives a graceful fallback line instead of crashing the conversation.

### Not yet wired
Nothing — see the **Real Voice** section below; the booking agent now handles real inbound phone calls end-to-end.

## Receipt Scanner module (`/receipts`)

- Drag-and-drop (or browse) upload for JPG/PNG/WEBP/GIF/PDF, up to 10MB.
- Claude reads the image/PDF directly (native vision — no separate OCR service) and returns strict structured JSON: vendor, total, tax, date, category, and line items.
- **Honest failure handling**: unlike the recovery and booking agents, this module does **not** fall back to fabricated placeholder data if extraction fails or the image is unreadable — a wrong number on a real supplier invoice is worse than no number. You'll get a clear error and can retry with a clearer photo instead.
- **Price-spike detection is plain arithmetic, not an LLM guess**: each new line item's unit price is compared against the historical average for that same item name across your past receipts; anything >20% above average flags the whole receipt (red warning icon in the table). No history yet for an item → nothing to compare against → not flagged.
- Files are stored in a private Supabase Storage bucket (`receipts`), scoped per business via RLS on `storage.objects` — same ownership model as the database tables. Viewing a receipt image generates a short-lived signed URL rather than exposing a public link.

### To use it
1. Run `supabase/migrations/0003_receipts_storage.sql` in the SQL Editor (creates the storage bucket + its RLS policies).
2. `ANTHROPIC_API_KEY` (already needed for recovery/booking) covers this module too.
3. Visit `/receipts` and drop in a photo of a real or sample receipt.

## Real Voice (Twilio Voice + built-in speech-to-text/text-to-speech)

The booking agent now answers real phone calls, not just the text simulator. Architecture:

- **Speech-to-text**: handled by Twilio's own `<Gather input="speech">` — no separate Deepgram/Whisper integration needed. Twilio transcribes the caller's speech server-side and POSTs the text to your webhook.
- **Text-to-speech**: handled by Twilio's `<Say>` verb using an Amazon Polly voice (`Polly.Aditi`, Indian English) — again, no separate TTS service.
- **Conversation state**: Twilio Voice webhooks are stateless HTTP requests — each turn is a brand new POST with no session. A `call_sessions` table persists the transcript across turns, keyed by Twilio's `CallSid`, and is cleaned up when the call ends.
- **No user session on these routes** — Twilio calls in cold, so the webhook routes use the service-role admin client scoped by business lookup, not the cookie-based RLS client the rest of the app uses. Every webhook request's signature is verified (`lib/twilio/voice-verify.ts`) so nothing but genuine Twilio requests can drive a conversation or fabricate a call.
- **Same booking/anti-double-booking logic as the web simulator** — both now call the same shared `lib/booking/core.ts`, so there's exactly one place slot validation and conflict-checking can drift, not two copies to keep in sync.

### To use it — real setup required
1. In your Twilio Console, buy a phone number with Voice capability (Phone Numbers → Buy a number).
2. Under that number's configuration, set:
   - **Voice → A call comes in**: Webhook, `https://your-real-domain.com/api/voice/incoming`, HTTP POST
   - **Voice → Call status changes**: `https://your-real-domain.com/api/voice/status`, HTTP POST (cleans up conversation state when a caller hangs up mid-conversation, not just on a completed booking)
3. Set `NEXT_PUBLIC_SITE_URL` in `.env.local`/production env to that **exact** public HTTPS URL — Twilio's signature verification will reject requests if this doesn't match precisely.
4. Log in to the app, go to **Settings**, and enter that same number in E.164 format (e.g. `+14155551234`) — this maps an incoming call to the right business.
5. Run `supabase/migrations/0005_voice_call_sessions.sql` if you already had the schema applied.
6. **Local testing**: Twilio needs a real public URL, so `localhost:3000` alone won't work — use `ngrok http 3000` (or similar) and set `NEXT_PUBLIC_SITE_URL` to the ngrok HTTPS URL while testing, then switch it back for production.
7. Call the number. You should hear the agent's opening line, be able to talk naturally, and get booked into a real slot that shows up instantly on `/booking`.

## What's next
- Polish pass: loading skeletons, empty-state illustrations, mobile responsiveness
- Optional: make the AI layer provider-agnostic (Claude vs. Gemini) — discussed but not yet built

All three core modules (booking, recovery, receipts) are now fully wired end-to-end: real auth, real RLS, real Claude API calls, real Twilio SMS/WhatsApp, and real Twilio Voice. No remaining functional gaps.
