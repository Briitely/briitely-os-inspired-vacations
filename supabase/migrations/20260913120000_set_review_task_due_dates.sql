create or replace function public.add_business_days(start_date date, business_days integer)
returns date
language plpgsql
immutable
as $$
declare
  result_date date := start_date;
  added integer := 0;
begin
  if business_days <= 0 then
    return result_date;
  end if;

  while added < business_days loop
    result_date := result_date + 1;
    if extract(isodow from result_date) between 1 and 5 then
      added := added + 1;
    end if;
  end loop;

  return result_date;
end;
$$;

create or replace function public.set_review_task_due_date()
returns trigger
language plpgsql
as $$
begin
  if new.due_date is null
     and new.title in (
       'Check for duplicate traveller files',
       'New booking form submitted with changes'
     ) then
    new.due_date := public.add_business_days(coalesce(new.created_at::date, current_date), 2);
  end if;

  return new;
end;
$$;

drop trigger if exists set_review_task_due_date on public.travel_file_tasks;
create trigger set_review_task_due_date
before insert on public.travel_file_tasks
for each row
execute function public.set_review_task_due_date();

-- Apply the same rule to existing open review tasks that do not yet have a due date.
update public.travel_file_tasks
set due_date = public.add_business_days(created_at::date, 2),
    updated_at = now()
where due_date is null
  and status <> 'complete'
  and title in (
    'Check for duplicate traveller files',
    'New booking form submitted with changes'
  );
