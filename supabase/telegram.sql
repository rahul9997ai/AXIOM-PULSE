-- Telegram connection for lien reminders. Run once in the Supabase SQL editor.
alter table public.profiles
  add column if not exists telegram_chat_id bigint,
  add column if not exists telegram_link_code text unique,
  add column if not exists telegram_link_expires timestamptz;

-- Only the RPCs below (or the service role) may change the Telegram columns.
create or replace function public.guard_telegram_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and current_setting('pulse.tg', true) is distinct from '1'
     and (new.telegram_chat_id is distinct from old.telegram_chat_id
       or new.telegram_link_code is distinct from old.telegram_link_code
       or new.telegram_link_expires is distinct from old.telegram_link_expires) then
    raise exception 'Use the Connect Telegram button';
  end if;
  return new;
end $$;
drop trigger if exists guard_telegram_columns on public.profiles;
create trigger guard_telegram_columns before update on public.profiles
  for each row execute function public.guard_telegram_columns();

create or replace function public.telegram_link_start() returns text
language plpgsql security definer set search_path = public as $$
declare c text := substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 20);
begin
  perform set_config('pulse.tg', '1', true);
  update public.profiles set telegram_link_code = c, telegram_link_expires = now() + interval '15 minutes' where id = auth.uid();
  return c;
end $$;

create or replace function public.telegram_unlink() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('pulse.tg', '1', true);
  update public.profiles set telegram_chat_id = null, telegram_link_code = null, telegram_link_expires = null where id = auth.uid();
end $$;

grant execute on function public.telegram_link_start() to authenticated;
grant execute on function public.telegram_unlink() to authenticated;
