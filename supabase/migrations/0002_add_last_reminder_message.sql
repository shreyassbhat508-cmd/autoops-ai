-- Run this only if you already executed schema.sql before the
-- last_reminder_message column was added to the invoices table.
alter table invoices add column if not exists last_reminder_message text;
