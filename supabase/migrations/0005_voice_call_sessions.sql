-- A business's inbound Twilio number, so the voice webhook knows which
-- business's calendar/agent to use based on the "To" number Twilio reports.
alter table businesses add column if not exists twilio_phone_number text unique;

-- Twilio Voice webhooks are stateless HTTP requests — each turn of the
-- phone conversation is a separate POST with no session of its own. This
-- table persists the conversation transcript across those requests, keyed
-- by Twilio's CallSid, for the duration of a single call.
create table if not exists call_sessions (
  call_sid text primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  history jsonb not null default '[]'::jsonb,
  silence_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- No RLS needed here — this table is only ever touched by the voice
-- webhook routes using the service-role admin client (Twilio requests
-- carry no Supabase user session to check against). Access is gated by
-- Twilio request-signature verification instead, at the route level.
alter table call_sessions enable row level security;
-- Intentionally no policies: default-deny for anon/authenticated roles,
-- only the service role (which bypasses RLS) can touch this table.
