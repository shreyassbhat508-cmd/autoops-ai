alter table invoices add column if not exists last_reminder_channel text;
alter table invoices add column if not exists last_reminder_delivery_status text
  check (last_reminder_delivery_status is null or last_reminder_delivery_status in ('sent', 'failed'));
