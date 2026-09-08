alter table public.travel_files
  add column if not exists primary_supplier text,
  add column if not exists supplier_final_payment_date date,
  add column if not exists client_final_payment_date date;
