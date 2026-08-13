-- ============================================================================
-- AutoOps AI — Database Schema + Row Level Security
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================================

-- 1. BUSINESSES
-- One row per signed-up owner. owner_id links 1:1 to auth.users.id.
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade unique,
  name text not null,
  owner_email text not null,
  industry text not null default 'general',
  twilio_phone_number text unique,
  created_at timestamptz not null default now()
);

-- 2. APPOINTMENTS
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  service_type text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'canceled')),
  created_at timestamptz not null default now()
);

-- 3. INVOICES
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  amount numeric(10, 2) not null,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('paid', 'overdue', 'pending', 'reminder_sent')),
  line_items jsonb not null default '[]'::jsonb,
  last_reminder_sent_at timestamptz,
  last_reminder_message text,
  last_reminder_channel text,
  last_reminder_delivery_status text
    check (last_reminder_delivery_status is null or last_reminder_delivery_status in ('sent', 'failed')),
  created_at timestamptz not null default now()
);

-- 4. RECEIPTS
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  vendor_name text,
  total_amount numeric(10, 2),
  category text,
  parsed_data jsonb not null default '{}'::jsonb,
  receipt_url text,
  price_flag boolean not null default false,
  uploaded_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists idx_appointments_business on appointments(business_id, scheduled_at);
create index if not exists idx_invoices_business on invoices(business_id, status, due_date);
create index if not exists idx_receipts_business on receipts(business_id, uploaded_at);

-- 5. CALL SESSIONS
-- Twilio Voice webhooks are stateless HTTP requests — this persists the
-- in-progress phone conversation transcript across them, keyed by
-- Twilio's CallSid. Only ever accessed via the service-role admin client
-- (Twilio requests carry no Supabase user session); RLS is enabled with
-- no policies, i.e. default-deny for anon/authenticated roles.
create table if not exists call_sessions (
  call_sid text primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  history jsonb not null default '[]'::jsonb,
  silence_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table call_sessions enable row level security;

-- ============================================================================
-- ROW LEVEL SECURITY
-- Every table is single-tenant per business, keyed off auth.uid().
-- ============================================================================
alter table businesses enable row level security;
alter table appointments enable row level security;
alter table invoices enable row level security;
alter table receipts enable row level security;

-- BUSINESSES: an owner can only ever see/edit their own business row.
drop policy if exists "Owners can view their own business" on businesses;
create policy "Owners can view their own business"
  on businesses for select
  using (auth.uid() = owner_id);

drop policy if exists "Owners can insert their own business" on businesses;
create policy "Owners can insert their own business"
  on businesses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update their own business" on businesses;
create policy "Owners can update their own business"
  on businesses for update
  using (auth.uid() = owner_id);

-- Helper pattern reused below: a row is visible only if its business_id
-- belongs to a business owned by the current authenticated user.

-- APPOINTMENTS
drop policy if exists "Owners can view their business's appointments" on appointments;
create policy "Owners can view their business's appointments"
  on appointments for select
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can insert appointments for their business" on appointments;
create policy "Owners can insert appointments for their business"
  on appointments for insert
  with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can update their business's appointments" on appointments;
create policy "Owners can update their business's appointments"
  on appointments for update
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can delete their business's appointments" on appointments;
create policy "Owners can delete their business's appointments"
  on appointments for delete
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- INVOICES
drop policy if exists "Owners can view their business's invoices" on invoices;
create policy "Owners can view their business's invoices"
  on invoices for select
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can insert invoices for their business" on invoices;
create policy "Owners can insert invoices for their business"
  on invoices for insert
  with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can update their business's invoices" on invoices;
create policy "Owners can update their business's invoices"
  on invoices for update
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can delete their business's invoices" on invoices;
create policy "Owners can delete their business's invoices"
  on invoices for delete
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- RECEIPTS
drop policy if exists "Owners can view their business's receipts" on receipts;
create policy "Owners can view their business's receipts"
  on receipts for select
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can insert receipts for their business" on receipts;
create policy "Owners can insert receipts for their business"
  on receipts for insert
  with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can update their business's receipts" on receipts;
create policy "Owners can update their business's receipts"
  on receipts for update
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "Owners can delete their business's receipts" on receipts;
create policy "Owners can delete their business's receipts"
  on receipts for delete
  using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- ============================================================================
-- SEED DATA (optional — comment out for a real production launch)
-- Replace 'YOUR-AUTH-USER-UUID' with a real auth.users.id after you sign up
-- once, so the seed rows attach to a real, RLS-visible business.
-- ============================================================================
-- insert into businesses (owner_id, name, owner_email, industry)
-- values ('YOUR-AUTH-USER-UUID', 'Sharma Auto Works', 'owner@example.com', 'auto_repair')
-- returning id; -- copy this id into the inserts below as :business_id

-- insert into appointments (business_id, customer_name, customer_phone, service_type, scheduled_at, status) values
-- (:business_id, 'Rahul Mehta', '+91 98765 43210', 'Oil change', now() + interval '1 day', 'scheduled'),
-- (:business_id, 'Priya Nair', '+91 98220 11223', 'Brake inspection', now() + interval '2 days', 'scheduled'),
-- (:business_id, 'Arjun Rao', '+91 90000 12345', 'AC service', now() + interval '3 days', 'scheduled'),
-- (:business_id, 'Kavya Iyer', '+91 99887 76655', 'Full service', now() - interval '1 day', 'completed'),
-- (:business_id, 'Sanjay Gupta', '+91 91234 56789', 'Tyre replacement', now() + interval '5 hours', 'scheduled');

-- insert into invoices (business_id, customer_name, customer_phone, amount, due_date, status, line_items) values
-- (:business_id, 'Kavya Iyer', '+91 99887 76655', 4500.00, current_date - interval '35 days', 'overdue', '[{"item":"Full service","amount":4500}]'),
-- (:business_id, 'Deepak Shah', '+91 98111 22334', 1200.00, current_date - interval '62 days', 'overdue', '[{"item":"Battery replacement","amount":1200}]'),
-- (:business_id, 'Meera Pillai', '+91 97000 88990', 800.00, current_date - interval '10 days', 'overdue', '[{"item":"Wiper blades","amount":300},{"item":"Labor","amount":500}]');

-- insert into receipts (business_id, vendor_name, total_amount, category, parsed_data, price_flag) values
-- (:business_id, 'AutoParts Wholesale', 15200.00, 'parts', '{"items":[{"name":"Brake pads (set)","qty":10,"unit_price":950}]}', true),
-- (:business_id, 'City Lubricants Co.', 6400.00, 'fluids', '{"items":[{"name":"Engine oil 5L","qty":16,"unit_price":400}]}', false);
