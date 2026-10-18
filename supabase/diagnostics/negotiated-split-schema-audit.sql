-- READ-ONLY schema audit for negotiated Travel File split.
-- Run in Supabase SQL Editor and share the results before applying split migrations.
-- No data is inserted, updated, or deleted.
select 'columns' as section, table_name as object_name, column_name as item,
       data_type || case when is_nullable='NO' then ' NOT NULL' else '' end ||
       coalesce(' DEFAULT ' || column_default,'') as details
from information_schema.columns
where table_schema='public'
  and table_name in (
    'travel_files','travel_file_travellers','traveller_profiles',
    'travel_actions','travel_payments','travel_payment_groups',
    'travel_payment_group_travellers','travel_group_retainers',
    'travel_group_negotiations','travel_group_retainer_acceptances',
    'travel_group_retainer_payments','travel_file_group_splits'
  )
union all
select 'constraints', t.relname, c.conname,
       pg_get_constraintdef(c.oid)
from pg_constraint c
join pg_class t on t.oid=c.conrelid
join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public'
  and t.relname in (
    'travel_files','travel_file_travellers','traveller_profiles',
    'travel_actions','travel_payments','travel_payment_groups',
    'travel_payment_group_travellers','travel_group_retainers',
    'travel_group_negotiations','travel_group_retainer_acceptances',
    'travel_group_retainer_payments','travel_file_group_splits'
  )
order by section,object_name,item;
